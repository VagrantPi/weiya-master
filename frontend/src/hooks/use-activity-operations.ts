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

export const useActivityOperations = () => {
  const client = useIotaClient();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';
  const { network } = useIotaClientContext();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const { packageId, module } = getAnnualPartyConfig(network);
  const getTarget = (fn: string) => `${packageId}::${module}::${fn}`;

  const createActivity = useCallback(
    async (params: { name: string; initialAmount: bigint }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('create_activity'),
          arguments: [tx.pure.string(params.name), tx.pure.u64(params.initialAmount)],
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

        toast.success('Activity created');
        await queryClient.invalidateQueries({
          queryKey: ['activities'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`建立活動失敗：${error.message}`);
        } else {
          toast.error('建立活動失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, queryClient, signAndExecuteTransaction],
  );

  const joinActivity = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('join_activity'),
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

        toast.success('Joined activity');
        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['activities'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`加入活動失敗：${error.message}`);
        } else {
          toast.error('加入活動失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const addPrizeFund = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      amount: bigint;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('add_prize_fund'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.u64(params.amount),
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

        toast.success('Prize pool increased');
        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['activities'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`加碼獎金池失敗：${error.message}`);
        } else {
          toast.error('加碼獎金池失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const closeActivity = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('close_activity'),
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
        await queryClient.invalidateQueries({
          queryKey: ['activities'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`關閉活動失敗：${error.message}`);
        } else {
          toast.error('關閉活動失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const withdrawRemainingAfterClose = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('withdraw_remaining_after_close'),
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
        await queryClient.invalidateQueries({
          queryKey: ['activities'],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`領回剩餘獎金失敗：${error.message}`);
        } else {
          toast.error('領回剩餘獎金失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  return {
    createActivity,
    joinActivity,
    addPrizeFund,
    closeActivity,
    withdrawRemainingAfterClose,
    isPending,
  };
};

