import { useCallback } from 'react';
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientContext,
  useSignAndExecuteTransaction,
} from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getAnnualPartyModuleTarget } from '../consts/annual-party';

export const useActivityCloseOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';
  const queryClient = useQueryClient();

  const { fn } = getAnnualPartyModuleTarget(network);

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const closeActivity = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        toast.error('Wallet not connected');
        return;
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: fn('close_activity'),
          arguments: [tx.pure.id(params.activityId), tx.object(params.activityObjectId)],
        });

        const result = await signAndExecuteTransaction({
          transaction: tx,
          waitForTransaction: false,
        });

        if ('digest' in result && result.digest) {
          await client.waitForTransaction({
            digest: result.digest,
          });
        }

        toast.success('Activity closed');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`Failed to close activity: ${error.message}`);
        }
        throw error;
      }
    },
    [client, currentAddress, fn, network, queryClient, signAndExecuteTransaction],
  );

  const claimCloseReward = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      participantObjectId: string;
    }) => {
      if (!currentAddress) {
        toast.error('Wallet not connected');
        return;
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: fn('claim_close_reward'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.object(params.participantObjectId),
          ],
        });

        const result = await signAndExecuteTransaction({
          transaction: tx,
          waitForTransaction: false,
        });

        if ('digest' in result && result.digest) {
          await client.waitForTransaction({
            digest: result.digest,
          });
        }

        toast.success('Close reward claimed');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['participants', network, params.activityId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`Failed to claim close reward: ${error.message}`);
        }
        throw error;
      }
    },
    [client, currentAddress, fn, network, queryClient, signAndExecuteTransaction],
  );

  const withdrawRemainingAfterClose = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        toast.error('Wallet not connected');
        return;
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: fn('withdraw_remaining_after_close'),
          arguments: [tx.pure.id(params.activityId), tx.object(params.activityObjectId)],
        });

        const result = await signAndExecuteTransaction({
          transaction: tx,
          waitForTransaction: false,
        });

        if ('digest' in result && result.digest) {
          await client.waitForTransaction({
            digest: result.digest,
          });
        }

        toast.success('Remaining pool withdrawn');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`Failed to withdraw remaining pool: ${error.message}`);
        }
        throw error;
      }
    },
    [client, currentAddress, fn, network, queryClient, signAndExecuteTransaction],
  );

  return {
    closeActivity,
    claimCloseReward,
    withdrawRemainingAfterClose,
    isPending,
  };
};

