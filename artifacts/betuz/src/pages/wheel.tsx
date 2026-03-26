import { useState, useRef } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, useAnimation } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

const SEGMENTS = [
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '1.5x',color: '#1d4ed8', mult: 1.5 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '2x',  color: '#7c3aed', mult: 2 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '1.5x',color: '#1d4ed8', mult: 1.5 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '3x',  color: '#b45309', mult: 3 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '1.5x',color: '#1d4ed8', mult: 1.5 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '5x',  color: '#15803d', mult: 5 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '1.5x',color: '#1d4ed8', mult: 1.5 },
  { label: '0x',  color: '#1e293b', mult: 0 },
  { label: '50x', color: '#b91c1c', mult: 50 },
];

const N = SEGMENTS.length;
const segAngle = 360 / N;

export default function WheelPage() {
  const [bet, setBet] = useState(3000);
  const [spinning, setSpinning] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [result, setResult] = useState<typeof SEGMENTS[0] | null>(null);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const { toast } = useToast();
  const controls = useAnimation();
  const angleRef = useRef(0);

  const spinWheel = () => {
    if (spinning) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setSpinning(true);
    setResult(null);
    sounds.spin();

    // Call backend FIRST — server decides which segment
    play({ data: { gameType: 'wheel', betAmount: bet, gameData: {} } }, {
      onSuccess: async (data: any) => {
        const serverSegIdx: number = data.result?.segment ?? Math.floor(Math.random() * N);
        const seg = SEGMENTS[serverSegIdx] ?? SEGMENTS[0];

        const extraSpins = 5 + Math.floor(Math.random() * 3);
        // Correct formula: bring segment midpoint to the top pointer (-90°)
        // midpoint of seg i (unrotated) = i * segAngle - 90 + segAngle/2
        // to land at -90° we rotate by: -(i + 0.5) * segAngle (mod 360)
        const offset = ((-(serverSegIdx + 0.5) * segAngle) % 360 + 360) % 360;
        const targetAngle = angleRef.current + extraSpins * 360 + offset;

        await controls.start({
          rotate: targetAngle,
          transition: { duration: 4 + Math.random() * 2, ease: [0.2, 0, 0.1, 1] }
        });

        angleRef.current = targetAngle;
        setCurrentAngle(targetAngle);
        setResult(seg);
        setSpinning(false);

        if (seg.mult > 0) {
          sounds.bigWin();
          if (seg.mult >= 5) confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#D4AF37', '#fff'] });
        } else {
          sounds.lose();
        }
        toast({
          title: seg.mult > 0 ? `🎉 ${seg.label} — Yutdingiz!` : "😞 0x — Yutqazdingiz",
          description: seg.mult > 0 ? `${data.winAmount?.toLocaleString()} UZS` : undefined,
          variant: seg.mult > 0 ? 'default' : 'destructive'
        } as any);
      },
      onError: () => {
        setSpinning(false);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      }
    });
  };

  const size = 280;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;

  return (
    <div className="max-w-sm mx-auto space-y-4 py-4">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold">🎡 Baxt G'ildiragi</h1>
      </div>

      <div className="flex justify-center items-center relative" style={{ contain: "paint", isolation: "isolate" }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-3xl drop-shadow-lg">▼</div>
        <motion.svg width={size} height={size} animate={controls} style={{ originX: '50%', originY: '50%', willChange: 'transform' }}>
          {SEGMENTS.map((seg, i) => {
            const start = i * segAngle - 90;
            const end = start + segAngle;
            const startRad = (start * Math.PI) / 180;
            const endRad = (end * Math.PI) / 180;
            const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
            const midRad = ((start + segAngle / 2) * Math.PI) / 180;
            const tx = cx + (r * 0.65) * Math.cos(midRad);
            const ty = cy + (r * 0.65) * Math.sin(midRad);
            return (
              <g key={i}>
                <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                  fill={seg.color} stroke="#0f172a" strokeWidth="1.5" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                  fontSize="11" fontWeight="bold" fill="white"
                  transform={`rotate(${start + segAngle / 2}, ${tx}, ${ty})`}>
                  {seg.label}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={18} fill="#0f172a" stroke="#D4AF37" strokeWidth="3"/>
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#D4AF37">★</text>
        </motion.svg>
      </div>

      {result && (
        <div className={`text-center p-4 rounded-xl font-bold text-xl ${result.mult > 0 ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
          {result.mult > 0 ? `🎉 ${result.label} — ${(bet * result.mult).toLocaleString()} UZS` : "😞 Omadsiz!"}
        </div>
      )}

      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tikish (UZS)</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(3000, Math.floor(b / 2)))} disabled={spinning}>½</Button>
            <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={spinning} className="font-bold text-center"/>
            <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={spinning}>2x</Button>
          </div>
        </div>
        <Button variant="gold" className="w-full text-xl py-6" onClick={spinWheel} disabled={spinning}>
          {spinning ? "🌀 AYLANMOQDA..." : "🎡 AYLANTIRISH"}
        </Button>
      </div>
    </div>
  );
}
