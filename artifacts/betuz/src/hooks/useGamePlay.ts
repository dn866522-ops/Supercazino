import { useQueryClient } from "@tanstack/react-query";
import { usePlayGame, getGetMeQueryKey } from "@workspace/api-client-react";

export function useGamePlay() {
  const qc = useQueryClient();
  const { mutate, isPending } = usePlayGame();

  const play = (
    args: Parameters<typeof mutate>[0],
    callbacks?: {
      onSuccess?: (data: any) => void;
      onError?: (err: any) => void;
    }
  ) => {
    const bet = Number((args as any)?.data?.betAmount ?? 0);

    // Optimistic: immediately deduct bet from displayed balance
    if (bet > 0) {
      qc.setQueryData(getGetMeQueryKey(), (old: any) =>
        old ? { ...old, balance: Math.max(0, old.balance - bet) } : old
      );
    }

    mutate(args, {
      onSuccess: (data: any) => {
        // Set exact balance from server response
        if (typeof data?.newBalance === "number") {
          qc.setQueryData(getGetMeQueryKey(), (old: any) =>
            old ? { ...old, balance: data.newBalance } : old
          );
        }
        callbacks?.onSuccess?.(data);
      },
      onError: (err: any) => {
        // Roll back optimistic update on error
        if (bet > 0) {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }
        callbacks?.onError?.(err);
      },
    });
  };

  return { play, isPending };
}
