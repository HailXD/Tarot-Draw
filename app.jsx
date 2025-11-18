const { useEffect, useMemo, useRef, useState } = React;

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1414527899628736543/8fZ8xKUjgh1WI0_74Pigh5aej1npGWD64X95GJpFBK6eI9kr52fG8UM6vK0XVNgKjw1c";


const MAJOR_ARCANA = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
    "Strength",
    "The Hermit",
    "Wheel of Fortune",
    "Justice",
    "The Hanged Man",
    "Death",
    "Temperance",
    "The Devil",
    "The Tower",
    "The Star",
    "The Moon",
    "The Sun",
    "Judgement",
    "The World",
];

const SUITS = ["Wands", "Cups", "Swords", "Pentacles"];
const RANKS = [
    "Ace",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Page",
    "Knight",
    "Queen",
    "King",
];

function buildDeck() {
    const deck = [];
    for (let i = 0; i < MAJOR_ARCANA.length; i++) {
        deck.push({
            id: i,
            code: `MA${String(i).padStart(2, "0")}`,
            arcana: "Major",
            name: MAJOR_ARCANA[i],
        });
    }
    let id = MAJOR_ARCANA.length;
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({
                id: id++,
                code: `${suit.substring(0, 2).toUpperCase()}-${rank}`,
                arcana: "Minor",
                name: `${rank} of ${suit}`,
                suit,
                rank,
            });
        }
    }
    return deck;
}

function shuffle(arr, rand = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function shuffleWithOrientation(arr, rand = Math.random) {
    const randomFn = rand || Math.random;
    const order = shuffle(arr, randomFn);
    return order.map((c) => ({ ...c, reversed: randomFn() < 0.5 }));
}

function parsePositions(input, deckLen) {
    const nums = (input.match(/\d+/g) || [])
        .map((n) => parseInt(n, 10))
        .filter((n) => n >= 1 && n <= deckLen);
    const seen = new Set();
    const res = [];
    for (const n of nums) {
        if (!seen.has(n)) {
            seen.add(n);
            res.push(n - 1);
        }
    }
    return res;
}

function createSeededRandom(seed) {
    if (!seed) return Math.random;
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
        state = (state * 31 + seed.charCodeAt(i)) >>> 0;
    }
    if (state === 0) state = 1;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function generateRandomSeed() {
    return Math.random().toString(36).slice(2, 10);
}

function generateDefaultSeed() {
    // Provided seed generator based on timestamp
    return ((f) => f(f, Math.floor(Date.now() / 10)))((s, n) =>
        n < 26
            ? String.fromCharCode(97 + (n % 26))
            : s(s, Math.floor(n / 26)) + String.fromCharCode(97 + (n % 26))
    );
}

function TarotApp() {
    const fullDeck = useMemo(() => buildDeck(), []);
    const initialSeedRef = useRef(null);
    if (!initialSeedRef.current) {
        initialSeedRef.current = generateDefaultSeed();
    }
    const [seed, setSeed] = useState(initialSeedRef.current);
    const [shuffledDeck, setShuffledDeck] = useState(() =>
        shuffleWithOrientation(
            fullDeck,
            createSeededRandom(initialSeedRef.current)
        )
    );
    const [input, setInput] = useState("");
    const [dealt, setDealt] = useState([]);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);
    const [showDeck, setShowDeck] = useState(false);
    const [deckAnimating, setDeckAnimating] = useState(false);
    const [animDeck, setAnimDeck] = useState([]);
    const animTimersRef = useRef([]);
    const [drawCount, setDrawCount] = useState(5);
    const copyTimerRef = useRef(null);
    const [spreadCopied, setSpreadCopied] = useState(false);

    const setRandomSeed = () => {
        const next = generateRandomSeed();
        setSeed(next);
        return next;
    };

    const spreadText = useMemo(
        () =>
            dealt
                .map((d) => `${d.card.name}${d.reversed ? " (Reversed)" : ""}`)
                .join(", "),
        [dealt]
    );

    const copySpread = () => {
        if (!spreadText) return;
        const finish = () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            setSpreadCopied(true);
            copyTimerRef.current = setTimeout(() => setSpreadCopied(false), 1500);
        };
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(spreadText).then(finish).catch(() => {
                    // Fallback
                    const ta = document.createElement("textarea");
                    ta.value = spreadText;
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand("copy"); } catch (_) {}
                    document.body.removeChild(ta);
                    finish();
                });
            } else {
                const ta = document.createElement("textarea");
                ta.value = spreadText;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand("copy"); } catch (_) {}
                document.body.removeChild(ta);
                finish();
            }
        } catch (_) {
            // ignore
        }
    };

    const doShuffle = ({ randomizeSeed = false } = {}) => {
        setDealt([]);
        setInput("");
        setError(null);
        animTimersRef.current.forEach((id) => clearTimeout(id));
        animTimersRef.current = [];
        const seedValue = randomizeSeed ? setRandomSeed() : seed.trim();
        const rng = createSeededRandom(seedValue);
        const targetDeck = shuffleWithOrientation(fullDeck, rng);
        if (!showDeck) {
            setShuffledDeck(targetDeck);
            return;
        }
        const STEPS = 7;
        const INTERVAL = Math.round(1000 / STEPS);
        const startDeck = shuffledDeck.slice();
        const startIndex = new Map(startDeck.map((c, i) => [c.id, i]));
        const targetIndex = new Map(targetDeck.map((c, i) => [c.id, i]));
        const startOrient = new Map(startDeck.map((c) => [c.id, !!c.reversed]));
        const targetOrient = new Map(
            targetDeck.map((c) => [c.id, !!c.reversed])
        );

        setDeckAnimating(true);
        setAnimDeck(startDeck.map((c) => ({ ...c })));

        for (let s = 1; s <= STEPS; s++) {
            const id = setTimeout(() => {
                const progress = s / STEPS;
                const withKeys = startDeck.map((c) => {
                    const si = startIndex.get(c.id);
                    const ti = targetIndex.get(c.id);
                    const key = si + (ti - si) * progress + c.id * 1e-6;
                    const so = startOrient.get(c.id);
                    const to = targetOrient.get(c.id);
                    let rev = so;
                    if (so !== to)
                        rev = s < STEPS ? (s % 2 === 1 ? !so : so) : to;
                    return { card: c, key, reversed: rev };
                });
                withKeys.sort((a, b) => a.key - b.key);
                const next = withKeys.map((k) => ({
                    ...k.card,
                    reversed: k.reversed,
                }));
                setAnimDeck(next);
                if (s === STEPS) {
                    setShuffledDeck(targetDeck);
                    setDeckAnimating(false);
                }
            }, s * INTERVAL);
            animTimersRef.current.push(id);
        }
    };

    const postToDiscord = (out) => {
        try {
            const seedValue = seed.trim();
            const seedLine = seedValue ? `Seed: ${seedValue}` : "Seed: (random)";
            const positionsLine = out.map((item) => item.position).join(", ");
            const cardsLine = out
                .map((item) =>
                    item.reversed
                        ? `${item.card.name} (Reversed)`
                        : `${item.card.name}`
                )
                .join(", ");
            const content = `${seedLine}\n${positionsLine}\n${cardsLine}`;
            fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            }).catch(() => {});
        } catch (_) {
        }
    };

    const dealFromPicks = (picks) => {
        const seen = new Set();
        const out = [];
        for (const idx0 of picks) {
            if (idx0 < 0 || idx0 >= shuffledDeck.length) continue;
            if (seen.has(idx0)) continue;
            seen.add(idx0);
            const card = shuffledDeck[idx0];
            out.push({ card, reversed: !!card.reversed, position: idx0 + 1 });
        }
        if (out.length === 0) {
            setError("Enter positions like: 1, 5, 10 (within 1-78)");
            return;
        }
        setDealt(out);
        setError(null);
        requestAnimationFrame(() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
        );
        postToDiscord(out);
    };

    const onDeal = () => {
        const picks = parsePositions(input, shuffledDeck.length);
        if (picks.length === 0) {
            setError("Enter positions like: 1, 5, 10 (within 1-78)");
            return;
        }
        dealFromPicks(picks);
    };

    const onDrawRandom = () => {
        const n = Math.max(1, Math.min(31, parseInt(drawCount, 10) || 1));
        const max = shuffledDeck.length;
        const seedValue = seed.trim();
        const rand = createSeededRandom(seedValue);
        const picksSet = new Set();
        const picks = [];
        while (picks.length < n && picksSet.size < max) {
            const pos1 = Math.floor(rand() * max) + 1;
            if (!picksSet.has(pos1)) {
                picksSet.add(pos1);
                picks.push(pos1 - 1);
            }
        }
        const text = picks.map((i) => i + 1).join(", ");
        setInput(text);
        dealFromPicks(picks);
    };

    const onReset = () => {
        animTimersRef.current.forEach((id) => clearTimeout(id));
        animTimersRef.current = [];
        setDeckAnimating(false);
        setAnimDeck([]);

        setDealt([]);
        setInput("");
        setError(null);

        setShuffledDeck(fullDeck.map((c) => ({ ...c, reversed: false })));
    };

    useEffect(() => {
    }, []);

    return (
        <div className="theme-dark min-h-screen w-full">
            <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
                <div className="flex flex-col min-h-screen border-r border-white/10">
                    <header className="sticky top-0 z-20 glass-panel">
                    <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-4">
                        <div className="text-xl font-semibold tracking-wide">
                            Tarot Draw
                        </div>
                    </div>
                    </header>

                    <main className="mx-auto max-w-3xl px-4 py-8">
                    <section className="mb-8">
                        <div className="flex flex-col gap-3">
                            <label className="block">
                                <div
                                    className="mb-2 text-sm"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    Pick positions (comma/space separated)
                                </div>
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") onDeal();
                                    }}
                                    placeholder="e.g., 1, 3, 7, 10"
                                    className="w-full px-4 py-2 panel outline-none"
                                />
                            </label>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onDeal}
                                        className="btn btn-primary"
                                        title="Deal the selected cards"
                                    >
                                        Deal
                                    </button>
                                    <a
                                        href="https://https://chatgpt.com/g/g-p-67997c71dd008191a3bf4234aea323f6-hail"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-outline"
                                        title="Open notepad"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                            aria-hidden="true"
                                        >
                                            <rect
                                                x="5"
                                                y="3"
                                                width="14"
                                                height="18"
                                                rx="2"
                                            />
                                            <path d="M9 7h6M7 11h10M7 15h10" />
                                        </svg>
                                        <span className="sr-only">Notepad</span>
                                    </a>
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                    <label
                                        className="text-sm"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        Draw
                                    </label>
                                    <select
                                        value={drawCount}
                                        onChange={(e) =>
                                            setDrawCount(
                                                parseInt(e.target.value, 10)
                                            )
                                        }
                                        className="panel px-2 py-2 text-sm"
                                        title="How many positions to draw"
                                    >
                                        {Array.from(
                                            { length: 31 },
                                            (_, i) => i + 1
                                        ).map((n) => (
                                            <option key={n} value={n}>
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={onDrawRandom}
                                        className="btn btn-outline"
                                        title="Fill with N random positions and deal"
                                    >
                                        Draw random
                                    </button>
                                </div>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-3 text-rose-300 text-sm">
                                {error}
                            </div>
                        )}
                        <p
                            className="mt-3 text-sm"
                            style={{ color: "var(--text-muted)" }}
                        >
                            Tip: positions are from the current shuffled order
                            (1-78).
                        </p>
                        <div className="mt-4 flex flex-col gap-2">
                            <div
                                className="text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                Seed (optional)
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value)}
                                    placeholder="e.g., 12345"
                                    className="flex-1 px-4 py-2 panel outline-none"
                                />
                                <button
                                    onClick={setRandomSeed}
                                    className="btn btn-outline"
                                    title="Generate a random seed"
                                >
                                    Random
                                </button>
                            </div>
                        </div>
                    </section>

                    <section ref={tableRef} className="mb-10 scroll-anchor">
                        <h2 className="text-lg font-semibold mb-2">Spread</h2>
                        {dealt.length === 0 ? (
                            <div
                                className="text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                No cards dealt yet.
                            </div>
                        ) : (
                            <div
                                className="panel p-3 text-sm cursor-pointer select-text"
                                role="button"
                                tabIndex={0}
                                onClick={copySpread}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") copySpread();
                                }}
                            >
                                {spreadCopied ? "Copied" : spreadText}
                            </div>
                        )}
                    </section>

                    <section className="mt-8">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-lg font-semibold">
                                Deck Order
                            </h2>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowDeck((v) => !v)}
                                title={
                                    showDeck
                                        ? "Hide deck order"
                                        : "Show deck order"
                                }
                            >
                                {showDeck ? "Hide" : "Show"}
                            </button>
                            <button
                                onClick={() => doShuffle({ randomizeSeed: true })}
                                className="btn btn-outline"
                                title="Shuffle the full deck with a new seed"
                            >
                                Shuffle
                            </button>
                            <button
                                onClick={onReset}
                                className="btn btn-outline"
                                title="Reset to unshuffled deck"
                            >
                                Reset
                            </button>
                        </div>
                        {showDeck ? (
                            <div
                                className="panel p-3 text-sm"
                                style={{ lineHeight: 1.6 }}
                            >
                                {(deckAnimating ? animDeck : shuffledDeck).map(
                                    (c, idx) => (
                                        <div
                                            key={c.id}
                                            className={
                                                deckAnimating
                                                    ? "shuffle-tick"
                                                    : ""
                                            }
                                            style={
                                                deckAnimating
                                                    ? {
                                                          animation:
                                                              "shufflePulse 0.12s ease-in-out",
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {idx + 1}. {c.name}
                                            {c.reversed ? " (Reversed)" : ""}
                                        </div>
                                    )
                                )}
                            </div>
                        ) : (
                            <div
                                className="panel p-3 text-sm"
                                style={{ color: "var(--text-muted)" }}
                            >
                                Hidden (spoiler)
                            </div>
                        )}
                    </section>
                    </main>

                    <footer className="px-4 py-10 text-center text-xs text-zinc-300">
                        Card data is generic; no copyrighted card art is used.
                    </footer>
                </div>

                <aside className="min-h-screen">
                    <div className="sticky top-0 h-screen">
                        <iframe
                            src="https://text.is/"
                            title="Notes"
                            className="w-full h-full border-0"
                        />
                    </div>
                </aside>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<TarotApp />);
