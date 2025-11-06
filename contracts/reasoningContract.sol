// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ReasoningContract - MVP Proof-of-Reasoning on Hedera
 * @author Ontologic Team
 * @notice Implements a rule-based reasoning system with on-chain provenance
 * @dev This contract is part of the Ontologic three-layer provenance architecture:
 *      Layer 1: CONTRACTCALL - Validates input tokens and applies reasoning rules
 *      Layer 2: TOKENMINT - Mints output tokens via HTS as material consequence
 *      Layer 3: HCS MESSAGE - External proof submission to consensus topic (handled by client)
 *
 * Alpha v0.3 Implementation:
 * - Supports 2-token rules (RED + BLUE) and 3-token rules (RED + GREEN + BLUE)
 * - Enables dual-domain reasoning: Paint (subtractive) and Light (additive)
 * - Uses Hedera Token Service (HTS) precompile for token minting
 * - Emits Reasoned events with proof hash and URI for verification
 * - Soft-gate validation via checksummed EVM addresses
 */

/**
 * @dev ERC20 interface for token balance and decimals queries
 */
interface IERC20 {
    /// @notice Get token balance of an account
    /// @param account Address to query
    /// @return balance Token balance in atomic units
    function balanceOf(address account) external view returns (uint256 balance);

    /// @notice Get number of decimals for token
    /// @return decimals Number of decimal places
    function decimals() external view returns (uint8 decimals);
}

/**
 * @dev Hedera Token Service interface for token minting operations
 * @custom:address 0x167 (HTS precompile on Hedera)
 * @custom:security Contract must have supply key permissions for tokens being minted
 */
interface IHederaTokenService {
    /**
     * @notice Mint fungible tokens
     * @dev For fungible tokens, metadata array should be empty
     * @param token Address of token to mint
     * @param amount Number of tokens to mint (in atomic units)
     * @param metadata Array of metadata (unused for fungible tokens)
     * @return responseCode HTS response code (22 = SUCCESS)
     * @return newTotalSupply Updated total supply after minting
     * @return serialNumbers Serial numbers for NFTs (empty for fungible)
     */
    function mintToken(
        address token,
        uint64 amount,
        bytes[] calldata metadata
    )
        external
        returns (int64 responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);
}

contract ReasoningContract {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Hedera Token Service precompile address
    /// @dev Fixed address on Hedera network
    IHederaTokenService public constant HTS = IHederaTokenService(address(0x167));

    /// @notice EVM address for $RED token (soft-gate)
    /// @dev Checksummed address for 0.0.7204552
    address public constant RED_TOKEN_ADDR = 0x00000000000000000000000000000000006DEeC8;

    /// @notice EVM address for $GREEN token (soft-gate)
    /// @dev Checksummed address for 0.0.7204840
    address public constant GREEN_TOKEN_ADDR = 0x00000000000000000000000000000000006DEfE8;

    /// @notice EVM address for $BLUE token (soft-gate)
    /// @dev Checksummed address for 0.0.7204565
    address public constant BLUE_TOKEN_ADDR = 0x00000000000000000000000000000000006DEED5;

    /// @notice Contract owner (can set rules and update schema)
    address public owner;

    /// @notice Reasoning protocol schema hash for versioning
    bytes32 public reasoningSchemaHash;

    /**
     * @notice Reasoning rule structure
     * @param domain Hashed domain identifier (e.g., keccak256("color.paint"))
     * @param operator Hashed operation identifier (e.g., keccak256("mix_paint"))
     * @param inputs Array of input token addresses required for reasoning
     * @param outputToken Address of token to mint as reasoning output
     * @param ratioNumerator Mint ratio numerator (denominator is 1)
     * @param active Whether rule is currently enabled
     */
    struct Rule {
        bytes32 domain;
        bytes32 operator;
        address[] inputs;
        address outputToken;
        uint64 ratioNumerator;
        bool active;
    }

    /// @notice Mapping of rule IDs to rule definitions
    /// @dev Rule ID = keccak256(abi.encode(domain, operator, inputs))
    mapping(bytes32 => Rule) public rules;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Emitted when a new reasoning rule is configured
     * @param ruleId Unique identifier for the rule
     * @param domain Reasoning domain hash
     * @param operator Operation identifier hash
     * @param inputs Array of required input token addresses
     * @param outputToken Address of output token to mint
     * @param ratio Mint ratio numerator
     */
    event RuleSet(
        bytes32 indexed ruleId,
        bytes32 domain,
        bytes32 operator,
        address[] inputs,
        address outputToken,
        uint64 ratio
    );

    /**
     * @notice Emitted when a reasoning operation is successfully executed
     * @dev This event provides the proof hash and URI for Layer 3 (HCS) submission
     * @param ruleId Rule that was executed
     * @param caller Account that initiated the reasoning
     * @param inputUnits Number of input units consumed
     * @param mintedUnits Number of output units minted
     * @param proofHash keccak256 hash of canonical proof JSON
     * @param proofURI Optional URI for proof storage (IPFS, HCS, etc.)
     */
    event Reasoned(
        bytes32 indexed ruleId,
        address indexed caller,
        uint64 inputUnits,
        uint64 mintedUnits,
        bytes32 proofHash,
        string proofURI
    );

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts function access to contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the ReasoningContract
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
     * @dev Only callable by owner, used for protocol upgrades
     * @param _schemaHash New schema hash
     */
    function setSchemaHash(bytes32 _schemaHash) external onlyOwner {
        reasoningSchemaHash = _schemaHash;
    }

    /**
     * @notice Configure a new reasoning rule
     * @dev Rule ID is computed as keccak256(abi.encode(domain, operator, inputs))
     * @dev Supports 2-token rules (RED + BLUE) and 3-token rules (RED + GREEN + BLUE)
     * @param domain Domain identifier hash (e.g., keccak256("color.paint"))
     * @param operator Operation identifier hash (e.g., keccak256("mix_paint"))
     * @param inputs Array of input token addresses (2 or 3 tokens required)
     * @param outputToken Address of output token to mint
     * @param ratioNumerator Mint ratio (e.g., 1 means 1:1 ratio)
     * @return ruleId The computed rule identifier
     */
    function setRule(
        bytes32 domain,
        bytes32 operator,
        address[] calldata inputs,
        address outputToken,
        uint64 ratioNumerator
    ) external onlyOwner returns (bytes32 ruleId) {
        require(inputs.length >= 1 && inputs.length <= 4, "bad arity");
        require(outputToken != address(0), "no output");

        // Soft-gate validation: support 2-token and 3-token rules
        require(inputs.length == 2 || inputs.length == 3, "must provide 2 or 3 inputs");

        bool hasRed = false;
        bool hasGreen = false;
        bool hasBlue = false;

        for (uint256 i = 0; i < inputs.length; i++) {
            if (inputs[i] == RED_TOKEN_ADDR) hasRed = true;
            if (inputs[i] == GREEN_TOKEN_ADDR) hasGreen = true;
            if (inputs[i] == BLUE_TOKEN_ADDR) hasBlue = true;
        }

        // For 2-token rules: require RED + BLUE
        // For 3-token rules: require RED + GREEN + BLUE
        if (inputs.length == 2) {
            require(hasRed && hasBlue, "2-token rules require RED and BLUE");
        } else if (inputs.length == 3) {
            require(hasRed && hasGreen && hasBlue, "3-token rules require RED, GREEN, and BLUE");
        }

        // Compute deterministic rule ID
        ruleId = keccak256(abi.encode(domain, operator, inputs));
        rules[ruleId] = Rule(domain, operator, inputs, outputToken, ratioNumerator, true);

        emit RuleSet(ruleId, domain, operator, inputs, outputToken, ratioNumerator);
    }

    /*//////////////////////////////////////////////////////////////
                        REASONING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Execute a reasoning operation
     * @dev Validates input token balances, mints output tokens, and emits proof event
     * @dev Caller must hold sufficient balance of all input tokens
     * @dev Contract must have supply key permissions for output token
     * @param ruleId Identifier of rule to execute
     * @param inputUnits Number of input units to process
     * @param proofHash keccak256 hash of canonical proof JSON
     * @param proofURI Optional URI for external proof storage
     * @return minted Number of output tokens minted
     */
    function reason(
        bytes32 ruleId,
        uint64 inputUnits,
        bytes32 proofHash,
        string calldata proofURI
    ) external returns (uint64 minted) {
        Rule storage r = rules[ruleId];
        require(r.active, "rule off");

        // Validate caller has sufficient input token balances
        for (uint256 i = 0; i < r.inputs.length; i++) {
            IERC20 token = IERC20(r.inputs[i]);
            uint8 decimals = _safeDecimals(r.inputs[i]);
            uint256 requiredAtoms = uint256(inputUnits) * (10 ** decimals);
            require(token.balanceOf(msg.sender) >= requiredAtoms, "insufficient input");
        }

        // Calculate mint amount and call HTS precompile
        minted = inputUnits * r.ratioNumerator;
        (int64 responseCode,,) = HTS.mintToken(r.outputToken, minted, new bytes[](0));
        require(responseCode == 22, "mint fail"); // 22 == HTS SUCCESS

        // Emit proof event for Layer 3 (HCS) submission
        emit Reasoned(ruleId, msg.sender, inputUnits, minted, proofHash, proofURI);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Safely query token decimals with fallback
     * @dev Returns 8 decimals if query fails (common fallback for fungible tokens)
     * @param token Address of token to query
     * @return decimals Number of decimal places
     */
    function _safeDecimals(address token) internal view returns (uint8 decimals) {
        (bool success, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
        return success && data.length >= 32 ? abi.decode(data, (uint8)) : 8;
    }
}
