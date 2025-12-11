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

import { getAnnualPartyConfig } from '../consts/annual-party';

export const useBonusOperations = () => {
  const client = useIotaClient();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';
  const { network } = useIotaClientContext();
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId, module } = getAnnualPartyConfig(network);
  const getTarget = (fn: string) => `${packageId}::${module}::${fn}`;

  const createBonusEvent = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      bonusPerUser: bigint;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('create_bonus_event'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.u64(params.bonusPerUser),
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

        toast.success('Bonus event created');
        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['activities', network],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`建立參加獎事件失敗：${error.message}`);
        } else {
          toast.error('建立參加獎事件失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const claimBonus = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      participantObjectId: string;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('claim_bonus'),
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

        toast.success('Bonus claimed');
        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['my-participant'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`領取參加獎失敗：${error.message}`);
        } else {
          toast.error('領取參加獎失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const claimCloseReward = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      participantObjectId: string;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('claim_close_reward'),
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
          queryKey: ['my-participant'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`領取結算獎勵失敗：${error.message}`);
        } else {
          toast.error('領取結算獎勵失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  return {
    createBonusEvent,
    claimBonus,
    claimCloseReward,
    isPending,
  };
};

