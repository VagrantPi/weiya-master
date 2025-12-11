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

import type { GameRewardMode } from '../types/annual-party';
import { getAnnualPartyConfig } from '../consts/annual-party';

export const useGameOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId, module } = getAnnualPartyConfig(network);
  const target = (fn: string) => `${packageId}::${module}::${fn}`;

  const createGame = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      question: string;
      options: string[];
      rewardAmount: bigint;
      mode: GameRewardMode;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }
      if (params.options.length !== 4) {
        throw new Error('Game options must be length 4');
      }
      if (params.rewardAmount <= 0n) {
        throw new Error('Reward amount must be > 0');
      }

      const modeCode = params.mode === 'SINGLE' ? 0 : 1;

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: target('create_game'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.string(params.question),
            tx.pure.vector('string', params.options),
            tx.pure.u64(params.rewardAmount),
            tx.pure.u8(modeCode),
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

        toast.success('Game created');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['game', network],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`建立遊戲失敗：${error.message}`);
        } else {
          toast.error('建立遊戲失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const submitChoice = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      gameId: string;
      gameObjectId: string;
      choice: number;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }
      if (params.choice < 1 || params.choice > 4) {
        throw new Error('Choice must be between 1 and 4');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: target('submit_choice'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.id(params.gameId),
            tx.object(params.gameObjectId),
            tx.pure.u8(params.choice),
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

        toast.success('Choice submitted');

        await queryClient.invalidateQueries({
          queryKey: ['game', network, params.gameId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['game-participations', network, params.gameId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`提交答案失敗：${error.message}`);
        } else {
          toast.error('提交答案失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const revealGameAnswer = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      gameId: string;
      gameObjectId: string;
      correctOption: number;
      clientSeed?: bigint;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }
      if (params.correctOption < 1 || params.correctOption > 4) {
        throw new Error('Correct option must be between 1 and 4');
      }

      const seed = params.clientSeed ?? BigInt(Date.now());

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: target('reveal_game_answer'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.id(params.gameId),
            tx.object(params.gameObjectId),
            tx.pure.u8(params.correctOption),
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

        toast.success('Game answer revealed');

        await queryClient.invalidateQueries({
          queryKey: ['game', network, params.gameId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['game-participations', network, params.gameId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`公布答案失敗：${error.message}`);
        } else {
          toast.error('公布答案失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  const claimGameReward = useCallback(
    async (params: {
      activityId: string;
      activityObjectId: string;
      gameId: string;
      gameObjectId: string;
      participationObjectId: string;
    }) => {
      if (!currentAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const tx = new Transaction();

        tx.moveCall({
          target: target('claim_game_reward'),
          arguments: [
            tx.pure.id(params.activityId),
            tx.object(params.activityObjectId),
            tx.pure.id(params.gameId),
            tx.object(params.gameObjectId),
            tx.object(params.participationObjectId),
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

        toast.success('Game reward claimed');

        await queryClient.invalidateQueries({
          queryKey: ['activity', network, params.activityId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['game', network, params.gameId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['game-participations', network, params.gameId],
        });
      } catch (error) {
        if (error instanceof Error) {
          toast.error(`領取遊戲獎勵失敗：${error.message}`);
        } else {
          toast.error('領取遊戲獎勵失敗');
        }
        throw error;
      }
    },
    [client, currentAddress, network, queryClient, signAndExecuteTransaction],
  );

  return {
    createGame,
    submitChoice,
    revealGameAnswer,
    claimGameReward,
    isPending,
  };
};

