// Optional native Ledger deps, only installed for the hardware-signing path
// (makeLedgerAccount lazy-imports them). Declared so @aegis/chain typechecks and
// emits its .d.ts without these packages present — without them, local mode and
// every other package that imports @aegis/chain's types build fine.
declare module "@ledgerhq/hw-transport-node-hid";
declare module "@ledgerhq/hw-app-eth";
