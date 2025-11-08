// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ReasoningContract - Triadic Proof-of-Reasoning on Hedera
 * @author Ontologic Team
 * @notice Implements epistemic triad: Peirce (additive), Tarski (subtractive), Floridi (entity)
 * @dev This contract is part of the Ontologic three-layer provenance architecture:
 *      Layer 1: CONTRACTCALL - Validates input tokens and applies reasoning rules
 *      Layer 2: TOKENMINT - Mints output tokens via HTS as material consequence
 *      Layer 3: HCS MESSAGE - External proof submission to consensus topic (handled by client)
 *
 * Alpha v0.4.2 Implementation (Triad + Replay):
 * - ProofAdd (Peirce): Additive reasoning with token minting
 * - ProofCheck (Tarski): Subtractive reasoning with boolean verdict
 * - ProofEntity (Floridi): Entity manifest publication with projections
 * - ProofReplay: Idempotent proof execution with replay detection
 * - Projection registry: Domain-scoped RGB values for tokens
 * - Subtractive math: LIGHT (channelwise RGB), PAINT (CMY model)
 * - Triple-equality: hash_local == hash_event == hash_hcs
 * - Canonical proof caching: One proof per (domain, operator, inputs)
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

    /// @notice Domain constants for deterministic hashing
    bytes32 public constant D_LIGHT = keccak256("color.light");
    bytes32 public constant D_PAINT = keccak256("color.paint");

    /// @notice Operator constants for deterministic hashing
    bytes32 public constant OP_ADD = keccak256("mix_add@v1");
    bytes32 public constant OP_SUB = keccak256("check_sub@v1");

    /// @notice EVM address for $RED token (soft-gate)
    /// @dev Configurable post-deployment, initialized to zero
    address public RED_TOKEN_ADDR;

    /// @notice EVM address for $GREEN token (soft-gate)
    /// @dev Configurable post-deployment, initialized to zero
    address public GREEN_TOKEN_ADDR;

    /// @notice EVM address for $BLUE token (soft-gate)
    /// @dev Configurable post-deployment, initialized to zero
    address public BLUE_TOKEN_ADDR;

    /// @notice EVM address for $YELLOW token (RGB+CMY secondary)
    /// @dev Configurable post-deployment, initialized to zero
    address public YELLOW_TOKEN_ADDR;

    /// @notice EVM address for $CYAN token (RGB+CMY secondary)
    /// @dev Configurable post-deployment, initialized to zero
    address public CYAN_TOKEN_ADDR;

    /// @notice EVM address for $MAGENTA token (RGB+CMY secondary)
    /// @dev Configurable post-deployment, initialized to zero
    address public MAGENTA_TOKEN_ADDR;

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

    /// @notice Projection registry: domain → token → RGB24 value
    /// @dev RGB24 format: 0xRRGGBB (e.g., 0xFF00FF for purple in light domain)
    mapping(bytes32 => mapping(address => uint24)) public projections;

    /// @notice Canonical proof cache for replay detection
    /// @dev Maps proofHash → true if proof has been executed
    mapping(bytes32 => bool) public proofSeen;

    /// @notice Inputs hash guard for proof integrity
    /// @dev Maps proofHash → inputsHash to prevent replay with mutated inputs
    mapping(bytes32 => bytes32) public inputsHashOf;

    /// @notice Cached outputs for replayed proofs
    /// @dev Maps proofHash → (outputToken, outputAmount)
    struct CachedOutput {
        address token;
        uint64 amount;
    }
    mapping(bytes32 => CachedOutput) public cachedOutputs;

    /**
     * @notice Proof data bundle for v0.4.2 reasoning functions
     * @dev Bundles hash parameters and URI to reduce stack depth
     * @custom:field inputsHash Preimage hash for input validation
     * @custom:field proofHash keccak256 hash of canonical proof JSON
     * @custom:field factHash keccak256 hash of HCS message (reserved)
     * @custom:field ruleHash Hash of rule tuple (domain, operator, inputs) (reserved)
     * @custom:field canonicalUri Short URI for proof storage (e.g., "hcs://0.0.7204585/...")
     */
    struct ProofData {
        bytes32 inputsHash;
        bytes32 proofHash;
        bytes32 factHash;
        bytes32 ruleHash;
        string canonicalUri;
    }

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
     * @notice Emitted when additive reasoning is executed (Peirce/ProofAdd)
     * @dev This event provides the proof hash and URI for Layer 3 (HCS) submission
     * @param ruleId Rule that was executed
     * @param caller Account that initiated the reasoning
     * @param inputUnits Number of input units consumed
     * @param mintedUnits Number of output units minted
     * @param proofHash keccak256 hash of canonical proof JSON
     * @param canonicalUri URI for HCS message or proof storage
     */
    event ProofAdd(
        bytes32 indexed ruleId,
        address indexed caller,
        uint64 inputUnits,
        uint64 mintedUnits,
        bytes32 indexed proofHash,
        string canonicalUri
    );

    /**
     * @notice Emitted when subtractive reasoning check is executed (Tarski/ProofCheck)
     * @param proofHash keccak256 hash of canonical proof JSON
     * @param domain Domain hash (e.g., keccak256("color.light"))
     * @param A First input token address
     * @param B Second input token address
     * @param C Result token address to check
     * @param verdict Boolean result: true if A - B == C in domain
     * @param canonicalUri URI for HCS message or proof storage
     */
    event ProofCheck(
        bytes32 indexed proofHash,
        bytes32 indexed domain,
        address A,
        address B,
        address C,
        bool verdict,
        string canonicalUri
    );

    /**
     * @notice Emitted when entity manifest is published (Floridi/ProofEntity)
     * @param manifestHash keccak256 hash of entity manifest JSON
     * @param token Token address being described
     * @param uri URI for manifest storage (HCS, IPFS, etc.)
     * @param controller Address publishing the manifest
     */
    event ProofEntity(
        bytes32 indexed manifestHash,
        address indexed token,
        string uri,
        address indexed controller
    );

    /**
     * @notice Emitted when a proof is replayed (already seen)
     * @dev Lightweight event for duplicate proof submissions
     * @param proofHash keccak256 hash of canonical proof JSON
     * @param caller Account attempting the replay
     */
    event ProofReplay(
        bytes32 indexed proofHash,
        address indexed caller
    );

    /**
     * @notice Emitted when token addresses are configured
     * @dev Allows verification of token configuration via event logs
     * @param red EVM address for RED token
     * @param green EVM address for GREEN token
     * @param blue EVM address for BLUE token
     * @param yellow EVM address for YELLOW token
     * @param cyan EVM address for CYAN token
     * @param magenta EVM address for MAGENTA token
     */
    event TokenAddressesUpdated(
        address indexed red,
        address indexed green,
        address indexed blue,
        address yellow,
        address cyan,
        address magenta
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
     * @notice Configure token addresses post-deployment
     * @dev Only callable by owner, breaks circular dependency with token creation
     * @dev This allows contract deployment before tokens are created
     * @param _red EVM address for RED token
     * @param _green EVM address for GREEN token
     * @param _blue EVM address for BLUE token
     * @param _yellow EVM address for YELLOW token
     * @param _cyan EVM address for CYAN token
     * @param _magenta EVM address for MAGENTA token
     */
    function setTokenAddresses(
        address _red,
        address _green,
        address _blue,
        address _yellow,
        address _cyan,
        address _magenta
    ) external onlyOwner {
        require(_red != address(0), "RED cannot be zero");
        require(_green != address(0), "GREEN cannot be zero");
        require(_blue != address(0), "BLUE cannot be zero");
        require(_yellow != address(0), "YELLOW cannot be zero");
        require(_cyan != address(0), "CYAN cannot be zero");
        require(_magenta != address(0), "MAGENTA cannot be zero");

        RED_TOKEN_ADDR = _red;
        GREEN_TOKEN_ADDR = _green;
        BLUE_TOKEN_ADDR = _blue;
        YELLOW_TOKEN_ADDR = _yellow;
        CYAN_TOKEN_ADDR = _cyan;
        MAGENTA_TOKEN_ADDR = _magenta;

        emit TokenAddressesUpdated(_red, _green, _blue, _yellow, _cyan, _magenta);
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
     * @notice Execute additive reasoning (Peirce/ProofAdd) - Legacy v0.4.1 interface
     * @dev Validates input token balances, mints output tokens, and emits proof event
     * @dev Caller must hold sufficient balance of all input tokens
     * @dev Contract must have supply key permissions for output token
     * @dev NOTE: Does not support replay detection - use reasonAdd() for v0.4.2
     * @param ruleId Identifier of rule to execute
     * @param inputUnits Number of input units to process
     * @param proofHash keccak256 hash of canonical proof JSON (v0.4 with layer:"peirce")
     * @param canonicalUri URI for HCS message or proof storage
     * @return minted Number of output tokens minted
     */
    function reason(
        bytes32 ruleId,
        uint64 inputUnits,
        bytes32 proofHash,
        string calldata canonicalUri
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

        // Emit Peirce proof event (layer:"peirce", mode:"additive")
        emit ProofAdd(ruleId, msg.sender, inputUnits, minted, proofHash, canonicalUri);
    }

    /**
     * @notice Execute additive reasoning with replay detection (v0.4.2)
     * @dev Idempotent: replays emit ProofReplay and return cached output
     * @dev Enforces domain=D_LIGHT and uses deterministic RGB→CMY mapping
     * @param A First input token address
     * @param B Second input token address
     * @param domainHash Domain identifier (must be D_LIGHT)
     * @param p Proof data bundle (inputsHash, proofHash, factHash, ruleHash, canonicalUri)
     * @return outToken Address of output token
     * @return amount Number of output tokens minted (or cached amount for replay)
     */
    function reasonAdd(
        address A,
        address B,
        bytes32 domainHash,
        ProofData calldata p
    ) external returns (address outToken, uint64 amount) {
        // Enforce light domain only for additive reasoning
        require(domainHash == D_LIGHT, "domain must be D_LIGHT");

        // Validate inputsHash matches computed hash
        require(p.inputsHash == _inputsHashAdd(A, B, domainHash), "inputsHash-mismatch");

        // Check for replay
        if (proofSeen[p.proofHash]) {
            emit ProofReplay(p.proofHash, msg.sender);
            CachedOutput memory cached = cachedOutputs[p.proofHash];
            return (cached.token, cached.amount);
        }

        // Fresh proof: use deterministic RGB→CMY mapping
        (outToken, amount) = _mixAddDeterministic(A, B);

        // Validate caller has sufficient input token balances
        IERC20 tokenA = IERC20(A);
        IERC20 tokenB = IERC20(B);
        uint8 decimalsA = _safeDecimals(A);
        uint8 decimalsB = _safeDecimals(B);
        require(tokenA.balanceOf(msg.sender) >= 10 ** decimalsA, "insufficient A");
        require(tokenB.balanceOf(msg.sender) >= 10 ** decimalsB, "insufficient B");

        // Mint output token via HTS precompile
        (int64 responseCode,,) = HTS.mintToken(outToken, amount, new bytes[](0));
        require(responseCode == 22, "mint fail");

        // Cache proof and output
        proofSeen[p.proofHash] = true;
        inputsHashOf[p.proofHash] = p.inputsHash;
        cachedOutputs[p.proofHash] = CachedOutput(outToken, amount);

        // Emit Peirce proof event (layer:"peirce", mode:"additive")
        emit ProofAdd(p.proofHash, msg.sender, 1, amount, p.proofHash, p.canonicalUri);
    }

    /**
     * @notice Deterministic RGB→CMY additive color mapping
     * @dev Maps (RED,GREEN)→YELLOW, (GREEN,BLUE)→CYAN, (RED,BLUE)→MAGENTA
     * @param A First input token (order-invariant)
     * @param B Second input token (order-invariant)
     * @return outToken Address of output token
     * @return amount Number of tokens to mint (always 1)
     */
    function _mixAddDeterministic(address A, address B)
        internal
        pure
        returns (address outToken, uint64 amount)
    {
        // Sort inputs for order-invariance
        (address X, address Y) = A < B ? (A, B) : (B, A);

        // Map RGB primaries to CMY secondaries
        if (X == RED_TOKEN_ADDR && Y == GREEN_TOKEN_ADDR) {
            return (YELLOW_TOKEN_ADDR, 1);
        }
        if (X == GREEN_TOKEN_ADDR && Y == BLUE_TOKEN_ADDR) {
            return (CYAN_TOKEN_ADDR, 1);
        }
        if (X == RED_TOKEN_ADDR && Y == BLUE_TOKEN_ADDR) {
            return (MAGENTA_TOKEN_ADDR, 1);
        }

        revert("unsupported-additive-pair");
    }

    /**
     * @notice Register a projection for a token in a domain
     * @dev Only owner can register projections
     * @param domain Domain hash (e.g., keccak256("color.light"))
     * @param token Token address
     * @param rgb24 RGB value in 24-bit format (0xRRGGBB)
     */
    function registerProjection(bytes32 domain, address token, uint24 rgb24) external onlyOwner {
        projections[domain][token] = rgb24;
    }

    /**
     * @notice Execute subtractive reasoning check with replay detection (Tarski/ProofCheck)
     * @dev Returns boolean verdict, never reverts on logical failure
     * @dev Uses projection registry for RGB values
     * @dev Idempotent: replays emit ProofReplay and re-compute verdict
     * @param A First input token address
     * @param B Second input token address
     * @param C Result token address to verify
     * @param domainHash Domain hash for subtractive logic (D_LIGHT or D_PAINT)
     * @param p Proof data bundle (inputsHash, proofHash, factHash, ruleHash, canonicalUri)
     * @return verdict True if A - B == C in the specified domain
     */
    function reasonCheckSub(
        address A,
        address B,
        address C,
        bytes32 domainHash,
        ProofData calldata p
    ) external returns (bool verdict) {
        // Validate inputsHash
        require(p.inputsHash == inputsHashSub(A, B, C, domainHash), "inputsHash-mismatch");

        // Check for replay
        if (proofSeen[p.proofHash]) {
            emit ProofReplay(p.proofHash, msg.sender);
            // Re-compute verdict (negligible cost)
        }

        // Fetch and validate projections
        uint24 rgbA = projections[domainHash][A];
        if (rgbA == 0 || projections[domainHash][B] == 0 || projections[domainHash][C] == 0) {
            if (!proofSeen[p.proofHash]) {
                proofSeen[p.proofHash] = true;
                inputsHashOf[p.proofHash] = p.inputsHash;
                emit ProofCheck(p.proofHash, domainHash, A, B, C, false, p.canonicalUri);
            }
            return false;
        }

        // Compute verdict: A - B == C?
        verdict = (_subtractRGB(rgbA, projections[domainHash][B], domainHash) == projections[domainHash][C]);

        // Cache proof and emit event (skip if replay)
        if (!proofSeen[p.proofHash]) {
            proofSeen[p.proofHash] = true;
            inputsHashOf[p.proofHash] = p.inputsHash;
            emit ProofCheck(p.proofHash, domainHash, A, B, C, verdict, p.canonicalUri);
        }
    }

    /**
     * @notice Publish entity manifest (Floridi/ProofEntity)
     * @dev Binds token to governance metadata and domain projections
     * @param token Token address
     * @param manifestHash keccak256 hash of entity manifest JSON
     * @param uri URI for manifest storage (HCS topic, IPFS, etc.)
     */
    function publishEntity(
        address token,
        bytes32 manifestHash,
        string calldata uri
    ) external {
        emit ProofEntity(manifestHash, token, uri, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Compute inputsHash for additive reasoning with order-invariance
     * @dev Deterministic preimage: (min(A,B), max(A,B), domain, OP_ADD)
     * @dev Order-invariant: inputsHashAdd(A,B,d) == inputsHashAdd(B,A,d)
     * @param A First input token
     * @param B Second input token
     * @param domainHash Domain identifier
     * @return inputsHash keccak256 of inputs tuple
     */
    function _inputsHashAdd(address A, address B, bytes32 domainHash)
        internal
        pure
        returns (bytes32)
    {
        (address X, address Y) = A < B ? (A, B) : (B, A);
        return keccak256(abi.encode(X, Y, domainHash, OP_ADD));
    }

    /**
     * @notice Public wrapper for _inputsHashAdd for off-chain verification
     * @param A First input token
     * @param B Second input token
     * @param domainHash Domain identifier
     * @return inputsHash keccak256 of inputs tuple
     */
    function inputsHashAdd(address A, address B, bytes32 domainHash)
        public
        pure
        returns (bytes32)
    {
        return _inputsHashAdd(A, B, domainHash);
    }

    /**
     * @notice Compute inputsHash for subtractive reasoning
     * @dev Deterministic preimage: (A, B, C, domain, OP_SUB)
     * @param A First input token
     * @param B Second input token
     * @param C Third input token
     * @param domainHash Domain identifier
     * @return inputsHash keccak256 of inputs tuple
     */
    function inputsHashSub(address A, address B, address C, bytes32 domainHash)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(A, B, C, domainHash, OP_SUB));
    }

    /**
     * @notice Check if a proof has been seen (executed)
     * @param proofHash keccak256 hash of canonical proof JSON
     * @return seen True if proof has been executed
     */
    function seen(bytes32 proofHash) external view returns (bool) {
        return proofSeen[proofHash];
    }

    /**
     * @notice Get the inputsHash for a previously executed proof
     * @param proofHash keccak256 hash of canonical proof JSON
     * @return inputsHash Cached inputsHash from original execution
     */
    function getInputsHash(bytes32 proofHash) external view returns (bytes32) {
        return inputsHashOf[proofHash];
    }

    /**
     * @notice Get RGB projection for a token in a domain
     * @param domainHash Domain identifier
     * @param token Token address
     * @return rgb24 RGB value in 24-bit format (0xRRGGBB)
     */
    function getRGB(bytes32 domainHash, address token) external view returns (uint24) {
        return projections[domainHash][token];
    }

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

    /**
     * @notice Perform subtractive RGB operation based on domain
     * @dev LIGHT domain: channelwise max(0, A - B)
     * @dev PAINT domain: RGB→CMY, subtract, clamp, CMY→RGB
     * @param a RGB value of first token (24-bit: 0xRRGGBB)
     * @param b RGB value of second token (24-bit: 0xRRGGBB)
     * @param domain Domain hash
     * @return RGB result of subtraction
     */
    function _subtractRGB(uint24 a, uint24 b, bytes32 domain) internal pure returns (uint24) {
        // LIGHT domain (color.light): channelwise subtraction with clamping
        if (domain == keccak256("color.light")) {
            return _subtractLightRGB(a, b);
        }

        // PAINT domain (color.paint): RGB→CMY, subtract, clamp, CMY→RGB
        if (domain == keccak256("color.paint")) {
            return _subtractPaintRGB(a, b);
        }

        // Default: return 0 for unknown domain
        return 0;
    }

    /**
     * @notice Subtract in LIGHT domain (channelwise RGB)
     */
    function _subtractLightRGB(uint24 a, uint24 b) internal pure returns (uint24) {
        uint8 ar = uint8(a >> 16);
        uint8 ag = uint8(a >> 8);
        uint8 ab = uint8(a);
        uint8 br = uint8(b >> 16);
        uint8 bg = uint8(b >> 8);
        uint8 bb = uint8(b);
        uint8 rr = ar > br ? ar - br : 0;
        uint8 rg = ag > bg ? ag - bg : 0;
        uint8 rb = ab > bb ? ab - bb : 0;
        return uint24(rr) << 16 | uint24(rg) << 8 | uint24(rb);
    }

    /**
     * @notice Subtract in PAINT domain (CMY model)
     */
    function _subtractPaintRGB(uint24 a, uint24 b) internal pure returns (uint24) {
        uint8 ar = uint8(a >> 16);
        uint8 ag = uint8(a >> 8);
        uint8 ab = uint8(a);
        uint8 br = uint8(b >> 16);
        uint8 bg = uint8(b >> 8);
        uint8 bb = uint8(b);
        // RGB → CMY
        uint8 ac = 255 - ar;
        uint8 am = 255 - ag;
        uint8 ay = 255 - ab;
        uint8 bc = 255 - br;
        uint8 bm = 255 - bg;
        uint8 by = 255 - bb;
        // Subtract in CMY
        uint8 rc = ac > bc ? ac - bc : 0;
        uint8 rm = am > bm ? am - bm : 0;
        uint8 ry = ay > by ? ay - by : 0;
        // CMY → RGB
        return uint24(255 - rc) << 16 | uint24(255 - rm) << 8 | uint24(255 - ry);
    }
}
