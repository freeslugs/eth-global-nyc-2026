// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal slice of the ENS v2 PermissionedResolver this contract talks to.
interface IPermissionedResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/**
 * @title SkillAttestations
 * @notice CRE DON attestation sink for ENS-registered skills.
 *
 * The Chainlink Keystone Forwarder is the only caller of `onReport`. When the DON
 * reaches consensus it delivers a report here, and this contract does two things:
 *
 *   1. Appends the attestation to an on-chain, append-only history keyed by the
 *      skill's ENS namehash (permissionless reads, no owner/admin/roles).
 *   2. Mirrors the verdict into ENS itself, writing a `safeskills.attestation.chainlink.eth`
 *      text record on the PermissionedResolver — the same record shape an off-chain
 *      verifier would write via `setText`. This makes the Chainlink CRE just another
 *      attestation provider that any `EnsV2Resolver` consumer reads natively.
 *
 * The written JSON matches the off-chain `encodeAttestation` format:
 *   {"provider":"chainlink.eth","status":"pass","score":80,
 *    "attestationId":"<inferenceId>","reviewedHash":"sha256:<hex>"}
 *
 * `score` is "higher = safer" (= 100 - riskScore), to match the Attestation port.
 * `reviewedHash` is read back from the resolver's `safeskills.pin` at write time,
 * binding the attestation to the content the DON actually reviewed.
 *
 * For the ENS write to succeed the org must authorize THIS contract's address for
 * the `safeskills.attestation.chainlink.eth` key on the resolver
 * (authorizeTextRoles / authorizeNameRoles). The on-chain history is written
 * unconditionally; if the resolver write reverts the whole report reverts, so
 * authorization must be in place before the DON delivers.
 */
contract SkillAttestations {
    /// @dev Chainlink Keystone Forwarder on Sepolia.
    address public constant FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;

    /// @notice This provider's identity, as it appears in the ENS record.
    string public constant PROVIDER = "chainlink.eth";

    /// @notice The ENS text-record key this contract writes.
    string public constant ATTESTATION_KEY = "safeskills.attestation.chainlink.eth";

    /// @notice The ENS text-record key the verdict binds to (the reviewed content hash).
    string public constant PIN_KEY = "safeskills.pin";

    /// @notice ENS v2 PermissionedResolver where skill text records live.
    IPermissionedResolver public immutable resolver;

    struct Attestation {
        uint8 statusCode;     // 1 = pass, 0 = fail
        uint8 riskScore;      // 0-100 (higher = riskier)
        string inferenceId;   // Confidential AI job ID (links to TEE-signed proof)
        uint64 timestamp;     // block.timestamp at write time
    }

    /// @notice All attestations for a skill, in chronological order.
    mapping(bytes32 => Attestation[]) private _attestations;

    event SkillAttested(
        bytes32 indexed node,
        uint8 indexed statusCode,
        uint8 riskScore,
        string inferenceId
    );

    /// @param _resolver ENS v2 PermissionedResolver address (e.g. AEGIS_ENS_RESOLVER).
    constructor(address _resolver) {
        resolver = IPermissionedResolver(_resolver);
    }

    /**
     * @notice Called by the Keystone Forwarder after the DON reaches consensus.
     * @dev report is abi.encode(bytes32 node, uint8 statusCode, uint8 riskScore, string inferenceId)
     */
    function onReport(bytes calldata /* metadata */, bytes calldata report) external {
        require(msg.sender == FORWARDER, "only forwarder");

        (bytes32 node, uint8 statusCode, uint8 riskScore, string memory inferenceId) =
            abi.decode(report, (bytes32, uint8, uint8, string));

        // 1. Append to the on-chain history.
        _attestations[node].push(Attestation({
            statusCode: statusCode,
            riskScore: riskScore,
            inferenceId: inferenceId,
            timestamp: uint64(block.timestamp)
        }));

        emit SkillAttested(node, statusCode, riskScore, inferenceId);

        // 2. Mirror into ENS as a chainlink.eth attestation text record.
        string memory reviewedHash = resolver.text(node, PIN_KEY);
        uint8 score = riskScore > 100 ? 0 : 100 - riskScore;

        string memory json = string.concat(
            '{"provider":"', PROVIDER,
            '","status":"', statusCode == 1 ? "pass" : "fail",
            '","score":', _toString(score),
            ',"attestationId":"', inferenceId,
            '","reviewedHash":"', reviewedHash,
            '"}'
        );

        resolver.setText(node, ATTESTATION_KEY, json);
    }

    /// @notice Returns every attestation ever recorded for a skill.
    function getAttestations(bytes32 node) external view returns (Attestation[] memory) {
        return _attestations[node];
    }

    /// @notice Convenience: how many times has a skill been reviewed?
    function attestationCount(bytes32 node) external view returns (uint256) {
        return _attestations[node].length;
    }

    /// @dev Minimal uint -> decimal string (sufficient for a 0-100 score).
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
