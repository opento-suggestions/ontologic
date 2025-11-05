// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title ReasoningContract — MVP Proof-of-Reasoning on Hedera
 * @notice Applies a simple rule ($RED + $BLUE → $PURPLE) and emits a verifiable proof event.
 */

interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IHederaTokenService {
    // Fungible mint; metadata ignored for fungible types
    function mintToken(
        address token,
        uint64 amount,
        bytes[] calldata metadata
    )
        external
        returns (int64 responseCode, uint64 newTotalSupply, int64[] memory serials);
}

contract ReasoningContract {
    // Hedera HTS precompile address
    IHederaTokenService constant HTS = IHederaTokenService(address(0x167));

    // Soft-gate constants for MVP
    string public constant RED_TOKEN_ID  = "0.0.7185272";
    string public constant BLUE_TOKEN_ID = "0.0.7185298";

    address public owner;
    bytes32 public reasoningSchemaHash;

    struct Rule {
        bytes32 domain;
        bytes32 operator;
        address[] inputs;
        address outputToken;
        uint64 ratioNumerator;
        bool active;
    }

    mapping(bytes32 => Rule) public rules;

    event RuleSet(
        bytes32 indexed ruleId,
        bytes32 domain,
        bytes32 operator,
        address[] inputs,
        address outputToken,
        uint64 ratio
    );

    event Reasoned(
        bytes32 indexed ruleId,
        address indexed caller,
        uint64 inputUnits,
        uint64 mintedUnits,
        bytes32 proofHash,
        string proofURI
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(bytes32 _schemaHash) {
        owner = msg.sender;
        reasoningSchemaHash = _schemaHash;
    }

    function setSchemaHash(bytes32 _schemaHash) external onlyOwner {
        reasoningSchemaHash = _schemaHash;
    }

    function setRule(
        bytes32 domain,
        bytes32 operator,
        address[] calldata inputs,
        address outputToken,
        uint64 ratioNumerator
    ) external onlyOwner returns (bytes32 ruleId) {
        require(inputs.length >= 1 && inputs.length <= 4, "bad arity");
        require(outputToken != address(0), "no output");

        // MVP soft-gate: enforce RED + BLUE primitive requirement
        require(inputs.length == 2, "must provide exactly two inputs");
        bool hasRed = false;
        bool hasBlue = false;
        for (uint256 i = 0; i < inputs.length; i++) {
            string memory tokenId = _toString(inputs[i]);
            if (keccak256(bytes(tokenId)) == keccak256(bytes(RED_TOKEN_ID))) hasRed = true;
            if (keccak256(bytes(tokenId)) == keccak256(bytes(BLUE_TOKEN_ID))) hasBlue = true;
        }
        require(hasRed && hasBlue, "missing RED or BLUE");

        ruleId = keccak256(abi.encode(domain, operator, inputs));
        rules[ruleId] = Rule(domain, operator, inputs, outputToken, ratioNumerator, true);

        emit RuleSet(ruleId, domain, operator, inputs, outputToken, ratioNumerator);
    }

    function reason(
        bytes32 ruleId,
        uint64 inputUnits,
        bytes32 proofHash,
        string calldata proofURI
    ) external returns (uint64 minted) {
        Rule storage r = rules[ruleId];
        require(r.active, "rule off");

        for (uint256 i = 0; i < r.inputs.length; i++) {
            IERC20 t = IERC20(r.inputs[i]);
            uint8 d = _safeDecimals(r.inputs[i]);
            uint256 atoms = uint256(inputUnits) * (10 ** d);
            require(t.balanceOf(msg.sender) >= atoms, "insufficient input");
        }

        minted = inputUnits * r.ratioNumerator;
        (int64 rc,,) = HTS.mintToken(r.outputToken, minted, new bytes[](0));
        require(rc == 22, "mint fail"); // 22 == SUCCESS

        emit Reasoned(ruleId, msg.sender, inputUnits, minted, proofHash, proofURI);
    }

    function _safeDecimals(address token) internal view returns (uint8) {
        (bool ok, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(IERC20.decimals.selector));
        return ok && data.length >= 32 ? abi.decode(data, (uint8)) : 8;
    }

    /**
     * @dev Converts an address to its hex string representation.
     * Used for comparing token addresses against Hedera token ID constants.
     */
    function _toString(address a) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(a)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}
