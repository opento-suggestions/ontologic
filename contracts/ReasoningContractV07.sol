// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ReasoningContractV07 - HCS-Referenced Rule Execution on Hedera
 * @author Ontologic Team
 * @notice v0.7 contract with rule references via HCS URIs
 * @dev Clean v0.7 interface - no legacy functions from v0.6.x
 *
 * Key Changes from v0.6.3:
 * - Rules are referenced by ruleUri (HCS message pointer)
 * - Contract logs ruleUri + ruleUriHash rather than executing embedded logic
 * - prepareReasoning() for pre-flight validation
 * - reason() for logging proof with rule reference
 * - reasonWithMint() for combined logging + HTS minting
 *
 * Architecture:
 * - Layer 1: CONTRACTCALL - Validates hashes, logs rule reference
 * - Layer 2: TOKENMINT - Mints output tokens via HTS precompile
 * - Layer 3: HCS MESSAGE - MorphemeProof v0.7 submitted to PROOF_TOPIC
 */

/**
 * @dev Hedera Token Service interface for token minting operations
 * @custom:address 0x167 (HTS precompile on Hedera)
 */
interface IHederaTokenService {
    function mintToken(
        address token,
        uint64 amount,
        bytes[] calldata metadata
    ) external returns (int64 responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);
}

contract ReasoningContractV07 {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Contract version
    string public constant VERSION = "v0.7.0";

    /// @notice Hedera Token Service precompile address
    IHederaTokenService public constant HTS = IHederaTokenService(address(0x167));

    /// @notice Contract owner
    address public owner;

    /// @notice Reasoning protocol schema hash for versioning
    bytes32 public reasoningSchemaHash;

    /// @notice Canonical proof cache for replay detection
    /// @dev Maps bindingHash → true if proof has been executed
    mapping(bytes32 => bool) public proofSeen;

    /// @notice Track prepared reasoning intents
    /// @dev Maps inputsHash → true if prepared
    mapping(bytes32 => bool) public preparedInputs;

    /// @notice Sphere configuration
    string public sphereName;
    string public ruleDefsTopicId;
    string public ruleRegistryTopicId;
    string public proofTopicId;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when reasoning is prepared (pre-flight)
     * @param ruleUri HCS URI pointing to RuleDef
     * @param ruleUriHash SHA256 hash of ruleUri string
     * @param inputsHash keccak256 hash of inputs JSON
     * @param caller Account that initiated preparation
     * @param timestamp Block timestamp
     */
    event Prepared(
        string ruleUri,
        bytes32 indexed ruleUriHash,
        bytes32 indexed inputsHash,
        address indexed caller,
        uint256 timestamp
    );

    /**
     * @notice Emitted when reasoning is executed
     * @param ruleUri HCS URI pointing to RuleDef
     * @param ruleUriHash SHA256 hash of ruleUri string
     * @param inputsHash keccak256 hash of inputs JSON
     * @param outputsHash keccak256 hash of outputs JSON
     * @param bindingHash Unique proof identifier
     * @param caller Account that executed reasoning
     * @param timestamp Block timestamp
     */
    event Reasoned(
        string ruleUri,
        bytes32 indexed ruleUriHash,
        bytes32 indexed inputsHash,
        bytes32 outputsHash,
        bytes32 indexed bindingHash,
        address caller,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a proof is replayed (already seen)
     * @param bindingHash The duplicate binding hash
     * @param caller Account attempting replay
     */
    event ProofReplay(
        bytes32 indexed bindingHash,
        address indexed caller
    );

    /**
     * @notice Emitted when sphere is configured
     * @param sphereName Name of the sphere
     * @param ruleDefsTopicId HCS topic for rule definitions
     * @param ruleRegistryTopicId HCS topic for rule registry entries
     * @param proofTopicId HCS topic for morpheme proofs
     */
    event SphereConfigured(
        string sphereName,
        string ruleDefsTopicId,
        string ruleRegistryTopicId,
        string proofTopicId
    );

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the ReasoningContractV07
     * @param _schemaHash Hash of the reasoning protocol schema version
     */
    constructor(bytes32 _schemaHash) {
        owner = msg.sender;
        reasoningSchemaHash = _schemaHash;
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update the reasoning protocol schema hash
     * @param _schemaHash New schema hash
     */
    function setSchemaHash(bytes32 _schemaHash) external onlyOwner {
        reasoningSchemaHash = _schemaHash;
    }

    /**
     * @notice Configure sphere topic IDs
     * @param _sphereName Name of the sphere (e.g., "demo")
     * @param _ruleDefsTopicId HCS topic for RuleDef messages
     * @param _ruleRegistryTopicId HCS topic for RuleRegistryEntry messages
     * @param _proofTopicId HCS topic for MorphemeProof messages
     */
    function configureSphere(
        string calldata _sphereName,
        string calldata _ruleDefsTopicId,
        string calldata _ruleRegistryTopicId,
        string calldata _proofTopicId
    ) external onlyOwner {
        sphereName = _sphereName;
        ruleDefsTopicId = _ruleDefsTopicId;
        ruleRegistryTopicId = _ruleRegistryTopicId;
        proofTopicId = _proofTopicId;

        emit SphereConfigured(_sphereName, _ruleDefsTopicId, _ruleRegistryTopicId, _proofTopicId);
    }

    /*//////////////////////////////////////////////////////////////
                        v0.7 REASONING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Pre-flight check for reasoning execution
     * @dev Validates ruleUri hash and marks inputs as prepared
     * @param ruleUri HCS URI pointing to RuleDef (e.g., "hcs://0.0.12345/1763200000.000000000")
     * @param ruleUriHash SHA256 hash of ruleUri string
     * @param inputsHash keccak256 hash of canonicalized inputs JSON
     */
    function prepareReasoning(
        string calldata ruleUri,
        bytes32 ruleUriHash,
        bytes32 inputsHash
    ) external {
        // Verify ruleUri hash
        require(sha256(bytes(ruleUri)) == ruleUriHash, "ruleUriHash mismatch");

        // Validate URI scheme
        require(_startsWithHcs(ruleUri), "Invalid URI scheme");

        // Mark as prepared
        preparedInputs[inputsHash] = true;

        emit Prepared(ruleUri, ruleUriHash, inputsHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Execute reasoning with rule reference (log only, no minting)
     * @dev Use this when minting is handled separately or not needed
     * @param ruleUri HCS URI pointing to RuleDef
     * @param ruleUriHash SHA256 hash of ruleUri string
     * @param inputsHash keccak256 hash of canonicalized inputs JSON
     * @param outputsHash keccak256 hash of canonicalized outputs JSON
     * @param bindingHash Unique proof identifier: keccak256({ruleUri, inputsHash, outputsHash})
     * @return ok True if reasoning was logged successfully
     */
    function reason(
        string calldata ruleUri,
        bytes32 ruleUriHash,
        bytes32 inputsHash,
        bytes32 outputsHash,
        bytes32 bindingHash
    ) external returns (bool ok) {
        // Verify ruleUri hash
        require(sha256(bytes(ruleUri)) == ruleUriHash, "ruleUriHash mismatch");

        // Check replay protection
        if (proofSeen[bindingHash]) {
            emit ProofReplay(bindingHash, msg.sender);
            return true; // Idempotent: return success for replays
        }

        // Mark as seen
        proofSeen[bindingHash] = true;

        emit Reasoned(
            ruleUri,
            ruleUriHash,
            inputsHash,
            outputsHash,
            bindingHash,
            msg.sender,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Execute reasoning with rule reference and mint output token
     * @dev Full v0.7 flow: validate, log, and mint in one transaction
     * @param ruleUri HCS URI pointing to RuleDef
     * @param ruleUriHash SHA256 hash of ruleUri string
     * @param inputsHash keccak256 hash of canonicalized inputs JSON
     * @param outputsHash keccak256 hash of canonicalized outputs JSON
     * @param bindingHash Unique proof identifier
     * @param outputToken Address of token to mint
     * @param amount Number of tokens to mint
     * @return ok True if reasoning + minting succeeded
     */
    function reasonWithMint(
        string calldata ruleUri,
        bytes32 ruleUriHash,
        bytes32 inputsHash,
        bytes32 outputsHash,
        bytes32 bindingHash,
        address outputToken,
        uint64 amount
    ) external returns (bool ok) {
        // Verify ruleUri hash
        require(sha256(bytes(ruleUri)) == ruleUriHash, "ruleUriHash mismatch");

        // Check replay protection
        if (proofSeen[bindingHash]) {
            emit ProofReplay(bindingHash, msg.sender);
            return true; // Idempotent: return success for replays
        }

        // Mark as seen
        proofSeen[bindingHash] = true;

        // Mint output token via HTS precompile
        (int64 responseCode, , ) = HTS.mintToken(outputToken, amount, new bytes[](0));
        require(responseCode == 22, "Mint failed"); // 22 = HTS SUCCESS

        emit Reasoned(
            ruleUri,
            ruleUriHash,
            inputsHash,
            outputsHash,
            bindingHash,
            msg.sender,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Batch reasoning: execute multiple proofs in one transaction
     * @dev Gas-efficient for executing related proofs together
     * @param ruleUris Array of HCS URIs
     * @param ruleUriHashes Array of SHA256 hashes
     * @param inputsHashes Array of inputs hashes
     * @param outputsHashes Array of outputs hashes
     * @param bindingHashes Array of binding hashes
     * @return count Number of proofs successfully executed
     */
    function reasonBatch(
        string[] calldata ruleUris,
        bytes32[] calldata ruleUriHashes,
        bytes32[] calldata inputsHashes,
        bytes32[] calldata outputsHashes,
        bytes32[] calldata bindingHashes
    ) external returns (uint256 count) {
        require(
            ruleUris.length == ruleUriHashes.length &&
            ruleUris.length == inputsHashes.length &&
            ruleUris.length == outputsHashes.length &&
            ruleUris.length == bindingHashes.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < ruleUris.length; i++) {
            // Skip if already seen
            if (proofSeen[bindingHashes[i]]) {
                emit ProofReplay(bindingHashes[i], msg.sender);
                continue;
            }

            // Verify hash
            require(sha256(bytes(ruleUris[i])) == ruleUriHashes[i], "ruleUriHash mismatch");

            // Mark and emit
            proofSeen[bindingHashes[i]] = true;
            emit Reasoned(
                ruleUris[i],
                ruleUriHashes[i],
                inputsHashes[i],
                outputsHashes[i],
                bindingHashes[i],
                msg.sender,
                block.timestamp
            );
            count++;
        }
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check if a proof has been executed
     * @param bindingHash Unique proof identifier
     * @return True if proof has been seen
     */
    function seen(bytes32 bindingHash) external view returns (bool) {
        return proofSeen[bindingHash];
    }

    /**
     * @notice Check if inputs have been prepared
     * @param inputsHash keccak256 hash of inputs
     * @return True if prepared
     */
    function isPrepared(bytes32 inputsHash) external view returns (bool) {
        return preparedInputs[inputsHash];
    }

    /**
     * @notice Get sphere configuration
     * @return _sphereName Name of configured sphere
     * @return _ruleDefsTopicId Rule definitions topic
     * @return _ruleRegistryTopicId Rule registry topic
     * @return _proofTopicId Proof topic
     */
    function getSphereConfig() external view returns (
        string memory _sphereName,
        string memory _ruleDefsTopicId,
        string memory _ruleRegistryTopicId,
        string memory _proofTopicId
    ) {
        return (sphereName, ruleDefsTopicId, ruleRegistryTopicId, proofTopicId);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Check if string starts with "hcs://"
     * @param s String to check
     * @return True if starts with "hcs://"
     */
    function _startsWithHcs(string memory s) internal pure returns (bool) {
        bytes memory sb = bytes(s);
        if (sb.length < 6) return false;
        return sb[0] == 'h' && sb[1] == 'c' && sb[2] == 's' &&
               sb[3] == ':' && sb[4] == '/' && sb[5] == '/';
    }

    /**
     * @notice Compute SHA256 hash of a string (for off-chain verification)
     * @param s String to hash
     * @return SHA256 hash
     */
    function computeRuleUriHash(string calldata s) external pure returns (bytes32) {
        return sha256(bytes(s));
    }
}
