import { Link } from "wouter";
import { motion } from "framer-motion";
import { sounds } from "@/lib/sounds";

export interface GameItem {
  id: string;
  emoji?: string;
  image?: string;          // cover image URL (served from /public/)
  name: string;
  sub: string;
  path: string;
  grad: string;
  hot: boolean;
}

interface GameCardProps {
  game: GameItem;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link href={game.path}>
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="relative cursor-pointer w-full"
        onClick={() => sounds.click()}
      >
        {/*
          2:3 portrait card — paddingTop trick keeps uniform height on all screens.
        */}
        <div
          className="relative w-full overflow-hidden shadow-md"
          style={{
            borderRadius: 12,
            paddingTop: "150%",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Background: real image or gradient fill */}
          {game.image ? (
            <img
              src={game.image}
              alt={game.name}
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: "center top",
                borderRadius: 12,
              }}
            />
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${game.grad}`}
              style={{ borderRadius: 12 }}
            />
          )}

          {/* HOT badge */}
          {game.hot && (
            <div
              className="absolute top-2 right-2 z-20 text-white font-black uppercase"
              style={{
                fontSize: 8,
                background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                padding: "2px 5px",
                borderRadius: 5,
                letterSpacing: "0.06em",
                boxShadow: "0 2px 8px rgba(220,38,38,0.55)",
              }}
            >
              HOT
            </div>
          )}

          {/* Emoji (only when no image) — upper area */}
          {!game.image && game.emoji && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ paddingBottom: "32%" }}
            >
              <span
                className="select-none leading-none"
                style={{
                  fontSize: "clamp(1.8rem, 7vw, 3.2rem)",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.55))",
                }}
              >
                {game.emoji}
              </span>
            </div>
          )}

          {/* Dark gradient overlay at bottom — always present */}
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 50%, transparent 100%)",
              padding: "0 5px 7px",
              minHeight: "42%",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            <span
              className="block w-full text-center text-white font-bold leading-tight"
              style={{
                fontSize: "clamp(8px, 2.1vw, 11px)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {game.name}
            </span>
            <span
              className="block w-full text-center mt-0.5"
              style={{
                fontSize: "clamp(6px, 1.6vw, 9px)",
                color: "rgba(255,255,255,0.50)",
              }}
            >
              {game.sub}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

interface GameGridProps {
  games: GameItem[];
  filter?: "all" | "hot";
  cols?: string;
}

export function GameGrid({ games, filter = "all", cols }: GameGridProps) {
  const shown = filter === "hot" ? games.filter((g) => g.hot) : games;
  const colsCls = cols ?? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5";
  return (
    <div className={`grid ${colsCls} gap-[10px] sm:gap-[14px]`}>
      {shown.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
