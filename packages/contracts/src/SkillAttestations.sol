// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SkillAttestations
 * @notice Append-only store for CRE DON attestations on ENS-registered skills.
 *
 * The Chainlink Keystone Forwarder is the only caller of `onReport`.
 * Everything else is permissionless: no owner, no admin, no roles.
 *
 * Each attestation is keyed by the ENS namehash of the skill
 * (e.g. namehash("algorithmic-art.acme.safeskills.eth")).
 * Multiple attestations per skill are stored in order — later reviews
 * append without touching earlier ones.
 *
 * The `inferenceId` ties each record back to the Confidential AI job,
 * where the TEE-signed output and digest can be independently verified.
 */
contract SkillAttestations {
    /// @dev Chainlink Keystone Forwarder on Sepolia.
    address public constant FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;

    struct Attestation {
        uint8 statusCode;     // 1 = pass, 0 = fail
        uint8 riskScore;      // 0-100
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

    /**
     * @notice Called by the Keystone Forwarder after the DON reaches consensus.
     * @dev report is abi.encode(bytes32 node, uint8 statusCode, uint8 riskScore, string inferenceId)
     */
    function onReport(bytes calldata /* metadata */, bytes calldata report) external {
        require(msg.sender == FORWARDER, "only forwarder");

        (bytes32 node, uint8 statusCode, uint8 riskScore, string memory inferenceId) =
            abi.decode(report, (bytes32, uint8, uint8, string));

        _attestations[node].push(Attestation({
            statusCode: statusCode,
            riskScore: riskScore,
            inferenceId: inferenceId,
            timestamp: uint64(block.timestamp)
        }));

        emit SkillAttested(node, statusCode, riskScore, inferenceId);
    }

    /// @notice Returns every attestation ever recorded for a skill.
    function getAttestations(bytes32 node) external view returns (Attestation[] memory) {
        return _attestations[node];
    }

    /// @notice Convenience: how many times has a skill been reviewed?
    function attestationCount(bytes32 node) external view returns (uint256) {
        return _attestations[node].length;
    }
}
