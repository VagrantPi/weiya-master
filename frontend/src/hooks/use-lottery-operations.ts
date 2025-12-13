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
import { toBaseUnits } from '../utils/iotaUnits';

export const useLotteryOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId, module, randomObjectId } = getAnnualPartyConfig(network);

  const getTarget = (fn: string) => `${packageId}::${module}::${fn}`;

  const createLottery = useCallback(
    async (params: { activityId: string; activityObjectId: string }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('create_lottery'),
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

        toast.success('Lottery created');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['lottery', network],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`建立樂透失敗：${error.message}`);
        } else {
          toast.error('建立樂透失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const joinLottery = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      lotteryId: string;
      lotteryObjectId: string;
      amount: bigint;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }
      if (params.amount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      try {
        const tx = new Transaction();

        // UI 以 IOTA 為單位，轉成鏈上最小單位
        const amountBase = toBaseUnits(params.amount);
        const amountArg = tx.pure.u64(amountBase);
        const [paymentCoin] = tx.splitCoins(tx.gas, [amountArg]);

        tx.moveCall({
          target: getTarget('join_lottery'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.pure.id(params.lotteryId),
            tx.object(params.activityObjectId),
            tx.object(params.lotteryObjectId),
            amountArg,
            paymentCoin,
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

        toast.success('Joined lottery');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['lottery', network, params.lotteryId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`參加樂透失敗：${error.message}`);
        } else {
          toast.error('參加樂透失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const executeLottery = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      lotteryId: string;
      lotteryObjectId: string;
      clientSeed?: bigint;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      const seed = params.clientSeed ?? BigInt(Date.now());

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: getTarget('execute_lottery'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.pure.id(params.lotteryId),
            tx.object(params.activityObjectId),
            tx.object(params.lotteryObjectId),
            tx.object(randomObjectId),
            tx.pure.u64(seed),
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

        toast.success('Lottery executed');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['lottery', network, params.lotteryId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`執行樂透失敗：${error.message}`);
        } else {
          toast.error('執行樂透失敗');
        }
        throw error;
      }
    },
    [
      client,
      currentAddress,
      network,
      queryClient,
      randomObjectId,
      signAndExecuteTransaction,
    ],
  );

  return {
    createLottery,
    joinLottery,
    executeLottery,
    isPending,
  };
};
