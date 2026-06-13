// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AttestationRegistry
/// @notice Stores attestations and revocations keyed by artifact subject hash.
/// @dev Skeleton: storage and events are realistic; access control is a
///      placeholder (`onlyForwarder`) to be wired to a trusted forwarder later.
contract AttestationRegistry {
    enum Kind {
        Provenance,
        Review,
        Confidential,
        Revocation
    }

    struct Attestation {
        bytes32 subject; // artifact bundle hash
        Kind kind;
        address attestor;
        bytes32 analyzer; // confidential lane (0x0 if unused)
        bytes payload; // verdict / score / flags, abi-encoded
        uint256 createdAt;
    }

    /// @dev subject => list of attestations.
    mapping(bytes32 => Attestation[]) private _attestations;
    /// @dev subject => revoked flag.
    mapping(bytes32 => bool) public revoked;

    /// @dev Trusted forwarder allowed to post on behalf of signers. 0x0 = open.
    address public forwarder;

    event Attested(
        bytes32 indexed subject,
        Kind indexed kind,
        address indexed attestor,
        uint256 index
    );
    event Revoked(bytes32 indexed subject, address indexed by);

    error NotForwarder();

    constructor(address forwarder_) {
        forwarder = forwarder_;
    }

    /// @dev Placeholder access control. When `forwarder` is unset (0x0), open.
    modifier onlyForwarder() {
        if (forwarder != address(0) && msg.sender != forwarder) {
            revert NotForwarder();
        }
        _;
    }

    function postAttestation(
        bytes32 subject,
        Kind kind,
        address attestor,
        bytes32 analyzer,
        bytes calldata payload
    ) external onlyForwarder returns (uint256 index) {
        index = _attestations[subject].length;
        _attestations[subject].push(
            Attestation({
                subject: subject,
                kind: kind,
                attestor: attestor,
                analyzer: analyzer,
                payload: payload,
                createdAt: block.timestamp
            })
        );
        emit Attested(subject, kind, attestor, index);
    }

    function revoke(bytes32 subject) external onlyForwarder {
        revoked[subject] = true;
        emit Revoked(subject, msg.sender);
    }

    function attestationCount(bytes32 subject) external view returns (uint256) {
        return _attestations[subject].length;
    }

    function getAttestation(bytes32 subject, uint256 index)
        external
        view
        returns (Attestation memory)
    {
        return _attestations[subject][index];
    }

    function getAttestations(bytes32 subject) external view returns (Attestation[] memory) {
        return _attestations[subject];
    }
}
