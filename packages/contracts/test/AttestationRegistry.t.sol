// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry internal registry;

    bytes32 internal constant SUBJECT = keccak256("sha256:deadbeef");
    address internal constant ATTESTOR = address(0xA11CE);

    event Attested(
        bytes32 indexed subject,
        AttestationRegistry.Kind indexed kind,
        address indexed attestor,
        uint256 index
    );
    event Revoked(bytes32 indexed subject, address indexed by);

    function setUp() public {
        // forwarder == 0x0 => open access for the skeleton.
        registry = new AttestationRegistry(address(0));
    }

    function test_PostAndRead() public {
        vm.expectEmit(true, true, true, true);
        emit Attested(SUBJECT, AttestationRegistry.Kind.Provenance, ATTESTOR, 0);

        uint256 index = registry.postAttestation(
            SUBJECT,
            AttestationRegistry.Kind.Provenance,
            ATTESTOR,
            bytes32(0),
            hex"01"
        );
        assertEq(index, 0);
        assertEq(registry.attestationCount(SUBJECT), 1);

        AttestationRegistry.Attestation memory a = registry.getAttestation(SUBJECT, 0);
        assertEq(a.subject, SUBJECT);
        assertEq(uint256(a.kind), uint256(AttestationRegistry.Kind.Provenance));
        assertEq(a.attestor, ATTESTOR);
        assertEq(a.payload, hex"01");
    }

    function test_MultipleAttestations() public {
        registry.postAttestation(SUBJECT, AttestationRegistry.Kind.Provenance, ATTESTOR, bytes32(0), "");
        registry.postAttestation(SUBJECT, AttestationRegistry.Kind.Review, ATTESTOR, bytes32(0), "");
        assertEq(registry.attestationCount(SUBJECT), 2);

        AttestationRegistry.Attestation[] memory all = registry.getAttestations(SUBJECT);
        assertEq(all.length, 2);
        assertEq(uint256(all[1].kind), uint256(AttestationRegistry.Kind.Review));
    }

    function test_RevokeAndRead() public {
        assertEq(registry.revoked(SUBJECT), false);

        vm.expectEmit(true, true, false, false);
        emit Revoked(SUBJECT, address(this));
        registry.revoke(SUBJECT);

        assertEq(registry.revoked(SUBJECT), true);
    }

    function test_OnlyForwarderEnforcedWhenSet() public {
        AttestationRegistry guarded = new AttestationRegistry(address(0xF0));

        vm.expectRevert(AttestationRegistry.NotForwarder.selector);
        guarded.revoke(SUBJECT);

        vm.prank(address(0xF0));
        guarded.revoke(SUBJECT);
        assertEq(guarded.revoked(SUBJECT), true);
    }
}
