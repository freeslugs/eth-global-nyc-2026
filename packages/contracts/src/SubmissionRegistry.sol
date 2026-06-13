// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SubmissionRegistry
/// @notice An org pays a fee to submit a skill for review. The fee payment is
///         the Chainlink CRE trigger: the workflow listens for `SubmissionPaid`,
///         fetches + reviews the SKILL.md, and writes the verdict to ENS.
/// @dev Logic is deliberately minimal — the event IS the integration seam.
contract SubmissionRegistry {
    /// @notice Emitted on a paid submission. The CRE workflow's trigger.
    /// @param node      ENS namehash of the skill name (verdict destination).
    /// @param pin       "sha256:<hex>" the org commits to (CRE rebinds to bytes).
    /// @param fetchUri  where the CRE pulls the SKILL.md from.
    /// @param isPrivate whether the fetch must be a confidential (TEE) fetch.
    /// @param submitter the paying org address.
    event SubmissionPaid(
        bytes32 indexed node,
        string pin,
        string fetchUri,
        bool isPrivate,
        address indexed submitter
    );

    /// @notice Flat submission fee, in wei.
    uint256 public immutable fee;

    /// @notice Owner may withdraw collected fees.
    address public immutable owner;

    error InsufficientFee(uint256 sent, uint256 required);
    error NotOwner();

    constructor(uint256 _fee) {
        fee = _fee;
        owner = msg.sender;
    }

    /// @notice Pay the fee to submit a skill for review.
    function submit(
        bytes32 node,
        string calldata pin,
        string calldata fetchUri,
        bool isPrivate
    ) external payable {
        if (msg.value < fee) revert InsufficientFee(msg.value, fee);
        // (demo) an org-control / registered-org check could go here.
        emit SubmissionPaid(node, pin, fetchUri, isPrivate, msg.sender);
    }

    /// @notice Withdraw collected fees to the owner.
    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }
}
