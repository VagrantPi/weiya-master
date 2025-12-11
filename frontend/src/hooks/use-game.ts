import { useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientContext,
} from '@iota/dapp-kit';
import type { IotaObjectResponse } from '@iota/iota-sdk/client';

import type { Activity, Game, GameParticipation, GameView } from '../types/annual-party';

const toBigIntSafe = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') {
    if (value === '') return 0n;
    return BigInt(value);
  }
  return 0n;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapGameFromObject = (obj: IotaObjectResponse): Game => {
  if (!obj.data) {
    throw new Error('Game 物件不存在');
  }

  const objectId = obj.data.objectId;
  const content = obj.data.content;

  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Game 內容格式錯誤');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFields: any =
    Array.isArray(content.fields) || content.fields == null
      ? {}
      : 'fields' in content.fields
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content.fields as any).fields
        : content.fields;

  const activityId = String(rawFields.activity_id ?? '');

  let status: 'OPEN' | 'ANSWER_REVEALED' | 'CLOSED' = 'OPEN';
  const statusRaw = rawFields.status;
  if (typeof statusRaw === 'string') {
    const upper = statusRaw.toUpperCase();
    if (upper === 'ANSWER_REVEALED') status = 'ANSWER_REVEALED';
    else if (upper === 'CLOSED') status = 'CLOSED';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variant = (statusRaw as any)?.variant ?? (statusRaw as any)?.fields?.variant;
    if (typeof variant === 'string') {
      const upper = variant.toUpperCase();
      if (upper === 'ANSWER_REVEALED') status = 'ANSWER_REVEALED';
      else if (upper === 'CLOSED') status = 'CLOSED';
    }
  }

  const question = String(rawFields.question ?? '');

  const options: string[] = Array.isArray(rawFields.options)
    ? rawFields.options.map((o: unknown) => String(o))
    : [];

  const rewardAmount = toBigIntSafe(rawFields.reward_amount ?? 0);

  let rewardMode: 'SINGLE' | 'AVERAGE' = 'SINGLE';
  const rewardModeRaw = rawFields.reward_mode;
  if (typeof rewardModeRaw === 'string') {
    const upper = rewardModeRaw.toUpperCase();
    rewardMode = upper === 'AVERAGE' ? 'AVERAGE' : 'SINGLE';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variant =
      (rewardModeRaw as any)?.variant ?? (rewardModeRaw as any)?.fields?.variant;
    if (typeof variant === 'string') {
      const upper = variant.toUpperCase();
      rewardMode = upper === 'AVERAGE' ? 'AVERAGE' : 'SINGLE';
    }
  }

  let correctOption: number | null = null;
  const correctRaw = rawFields.correct_option;
  if (correctRaw != null) {
    if (typeof correctRaw === 'number') {
      correctOption = correctRaw;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (correctRaw as any).fields ?? correctRaw;
      const inner = fields.value ?? fields.some ?? fields.option;
      if (typeof inner === 'number') {
        correctOption = inner;
      }
    }
  }

  const totalCorrect = toBigIntSafe(rawFields.total_correct ?? 0);

  let winnerAddr: string | null = null;
  const winnerRaw = rawFields.winner_addr;
  if (winnerRaw != null) {
    if (typeof winnerRaw === 'string') {
      winnerAddr = winnerRaw;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (winnerRaw as any).fields ?? winnerRaw;
      const inner = fields.value ?? fields.addr ?? fields.some;
      if (typeof inner === 'string') {
        winnerAddr = inner;
      }
    }
  }

  const participationIds: string[] = Array.isArray(rawFields.participation_ids)
    ? rawFields.participation_ids.map((id: unknown) => String(id))
    : [];

  const participationOwners: string[] = Array.isArray(
    rawFields.participation_owners,
  )
    ? rawFields.participation_owners.map((o: unknown) => String(o))
    : [];

  const participationChoices: number[] = Array.isArray(
    rawFields.participation_choices,
  )
    ? rawFields.participation_choices.map((c: unknown) => Number(c))
    : [];

  return {
    id: objectId,
    activityId,
    status,
    question,
    options,
    rewardAmount,
    rewardMode,
    correctOption,
    totalCorrect,
    winnerAddr,
    participationIds,
    participationOwners,
    participationChoices,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapGameParticipationFromObject = (obj: any): GameParticipation => {
  if (!obj.data) {
    throw new Error('GameParticipation 物件不存在');
  }

  const objectId: string = obj.data.objectId;
  const content = obj.data.content;

  if (!content || content.dataType !== 'moveObject') {
    throw new Error('GameParticipation 內容格式錯誤');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFields: any =
    Array.isArray(content.fields) || content.fields == null
      ? {}
      : 'fields' in content.fields
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content.fields as any).fields
        : content.fields;

  const gameId = String(rawFields.game_id ?? '');
  const activityId = String(rawFields.activity_id ?? '');
  const owner = String(rawFields.owner ?? '');
  const choice = Number(rawFields.choice ?? 0);
  const isCorrect = Boolean(rawFields.is_correct);
  const hasClaimedReward = Boolean(rawFields.has_claimed_reward);

  return {
    id: objectId,
    gameId,
    activityId,
    owner,
    choice,
    isCorrect,
    hasClaimedReward,
  };
};

export const useCurrentGame = (
  activity: Activity | null,
): UseQueryResult<GameView | null> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  const gameId = activity?.currentGameId ?? null;
  const enabled = Boolean(gameId);

  return useQuery({
    queryKey: ['game', network, gameId],
    enabled,
    queryFn: async () => {
      if (!gameId) return null;

      const res = await client.getObject({
        id: gameId,
        options: {
          showContent: true,
        },
      });

      if (!res.data || res.data.content == null) {
        return null;
      }

      const game = mapGameFromObject(res);

      const hasCorrectOption = game.correctOption !== null;
      const correctOptionLabel = hasCorrectOption
        ? `Option ${game.correctOption}`
        : null;

      const view: GameView = {
        game,
        isOpen: game.status === 'OPEN',
        isAnswerRevealed: game.status === 'ANSWER_REVEALED',
        isClosed: game.status === 'CLOSED',
        hasCorrectOption,
        correctOptionLabel,
      };

      return view;
    },
  });
};

export const useGameParticipations = (
  game: Game | null,
): UseQueryResult<GameParticipation[]> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  const ids = game?.participationIds ?? [];
  const enabled = Boolean(game) && ids.length > 0;

  return useQuery({
    queryKey: ['game-participations', network, game?.id],
    enabled,
    queryFn: async () => {
      if (!game || ids.length === 0) return [];

      const responses = await Promise.all(
        ids.map((id) =>
          client.getObject({
            id,
            options: {
              showContent: true,
            },
          }),
        ),
      );

      const list: GameParticipation[] = [];

      for (const res of responses) {
        if (!res.data || res.data.content == null) {
          // eslint-disable-next-line no-continue
          continue;
        }
        try {
          list.push(mapGameParticipationFromObject(res));
        } catch {
          // 忽略單筆解析失敗
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      return list;
    },
  });
};

export const useMyGameParticipation = (
  game: Game | null,
  participations: GameParticipation[],
) => {
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';

  return useMemo(() => {
    if (!game || !currentAddress) return null;
    const me = participations.find(
      (p) => p.gameId === game.id && p.owner === currentAddress,
    );
    return me ?? null;
  }, [game?.id, currentAddress, participations]);
};
