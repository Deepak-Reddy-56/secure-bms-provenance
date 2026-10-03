#!/usr/bin/env bash
set -euo pipefail

# Development-only cleanup for legacy/non-canonical Fabric test records.
# Safe by default:
#   without --apply: dry run only
#   with --apply: invokes the protected Fabric maintenance transaction
# Only the exact historical test IDs below are targeted.

FABRIC_SAMPLES_DIR="${FABRIC_SAMPLES_DIR:-$HOME/fabric/fabric-samples}"
CHANNEL_NAME="${FABRIC_CHANNEL:-mychannel}"
CHAINCODE_NAME="${FABRIC_CHAINCODE:-bmsprovenance}"
APPLY=false

case "${1:-}" in
  "")
    ;;
  --apply)
    APPLY=true
    ;;
  *)
    echo "Usage: $0 [--apply]"
    exit 2
    ;;
esac

PEER_BIN="$FABRIC_SAMPLES_DIR/bin/peer"
TEST_NETWORK_DIR="$FABRIC_SAMPLES_DIR/test-network"
ADMIN_MSP="$TEST_NETWORK_DIR/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
PEER0_TLS_ROOTCERT="$TEST_NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
PEER1_TLS_ROOTCERT="$TEST_NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
ORDERER_CA="$TEST_NETWORK_DIR/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"

TARGET_IDS=(
  "BMS-2026-001"
  "BMS-2026-002"
  "BMS-CERT-TEST-001"
  "BMS-DAY2-MFG-001"
  "BMS-REAL-CERT-001"
  "BMS-Test-Component"
  "BMS-Test-Component2"
)

require_file() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo "Required Fabric path not found:"
    echo "  $path"
    exit 1
  fi
}

require_file "$PEER_BIN"
require_file "$ADMIN_MSP"
require_file "$PEER0_TLS_ROOTCERT"
require_file "$PEER1_TLS_ROOTCERT"
require_file "$ORDERER_CA"

command -v jq >/dev/null 2>&1 || {
  echo "jq is required. Install it with: sudo apt install -y jq"
  exit 1
}

export PATH="$FABRIC_SAMPLES_DIR/bin:$PATH"
export FABRIC_CFG_PATH="$FABRIC_SAMPLES_DIR/config"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$PEER0_TLS_ROOTCERT"
export CORE_PEER_ADDRESS=localhost:7051

query_component() {
  local component_id="$1"
  local args
  args=$(jq -nc --arg id "$component_id" '{Args:["GetComponent",$id]}')
  "$PEER_BIN" chaincode query -C "$CHANNEL_NAME" -n "$CHAINCODE_NAME" -c "$args"
}

delete_component() {
  local component_id="$1"
  local args
  args=$(jq -nc --arg id "$component_id" '{Args:["DeleteLegacyComponentForCleanup",$id,"TEST_DATA_CLEANUP"]}')
  "$PEER_BIN" chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" -C "$CHANNEL_NAME" -n "$CHAINCODE_NAME" --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER0_TLS_ROOTCERT" --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER1_TLS_ROOTCERT" --waitForEvent --waitForEventTimeout 30s -c "$args"
}

echo "BMS legacy/test-data cleanup"
echo "Channel:   $CHANNEL_NAME"
echo "Chaincode: $CHAINCODE_NAME"
if [[ "$APPLY" == true ]]; then
  echo "Mode:      APPLY"
else
  echo "Mode:      DRY-RUN"
fi
echo

if ! "$PEER_BIN" lifecycle chaincode querycommitted -C "$CHANNEL_NAME" | grep -q "$CHAINCODE_NAME"; then
  echo "Chaincode '$CHAINCODE_NAME' is not committed on '$CHANNEL_NAME'."
  exit 1
fi

deleted=0
skipped=0

for component_id in "${TARGET_IDS[@]}"; do
  echo "Checking $component_id ..."

  if query_component "$component_id" >/dev/null 2>&1; then
    if [[ "$APPLY" == false ]]; then
      echo "  FOUND — would delete through Fabric maintenance transaction."
      skipped=$((skipped + 1))
      continue
    fi

    echo "  FOUND — deleting..."
    delete_component "$component_id"
    echo "  DELETED"
    deleted=$((deleted + 1))
  else
    echo "  NOT PRESENT — skipping."
    skipped=$((skipped + 1))
  fi
done

echo
if [[ "$APPLY" == true ]]; then
  echo "Cleanup complete. Deleted: $deleted. Skipped/not present: $skipped."
else
  echo "Dry run complete. No ledger state was changed."
  echo "After reviewing the exact targets, run:"
  echo
  echo "  $0 --apply"
fi
