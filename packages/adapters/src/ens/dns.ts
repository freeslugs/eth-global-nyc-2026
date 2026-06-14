// DNS wire-format encoder for ENS v2 `authorizeTextRoles`. Implementation lives
// in @aegis/chain (its ENS-wire home) so node-run scripts can import it without
// pulling the adapter bundle; re-exported here for app code + the unit test.
export { dnsEncode } from "@aegis/chain";
