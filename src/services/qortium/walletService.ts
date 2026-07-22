// Video Center — wallet service (name resolution + tipping)
// Canonical reference: Discussion-Boards/src/services/qortium/walletService.ts (VERIFIED-E2E)
//                     Discussion-Boards/src/features/forum/hooks/useThreadActions.ts handleSendTip() (VERIFIED-E2E)

import { requestQortium } from './qortiumClient';

export const resolveNameToAddress = async (name: string): Promise<string | null> => {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const response = await requestQortium<unknown>({
      action: 'GET_NAME_DATA',
      name: trimmed,
    });

    if (!response || typeof response !== 'object') return null;
    const record = response as Record<string, unknown>;

    return (
      (typeof record.ownerAddress === 'string' && record.ownerAddress.trim()) ||
      (typeof record.owner === 'string' && record.owner.trim()) ||
      (typeof record.address === 'string' && record.address.trim()) ||
      null
    );
  } catch {
    return null;
  }
};

export const sendTip = async (recipientName: string, amount: number): Promise<void> => {
  if (amount <= 0) throw new Error('Tip amount must be greater than zero.');

  const address = await resolveNameToAddress(recipientName);
  if (!address) {
    throw new Error(
      `Could not resolve address for "${recipientName}". Ensure the name is registered on the network.`,
    );
  }

  await requestQortium({
    action: 'SEND_COIN',
    coin: 'QORT',
    recipient: address,
    amount,
  });
};
