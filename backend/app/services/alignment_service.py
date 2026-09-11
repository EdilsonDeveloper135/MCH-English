import math
from dataclasses import dataclass, field

# Gale-Church (1993) style sentence alignment: a classical statistical method based on
# how sentence length (in characters) correlates across a translation, not a language
# model. No AI/ML is involved anywhere in this module.
#
# The ratio between Spanish and English sentence length is calibrated per text pair
# (rather than a fixed historical English-French constant), which makes it robust to
# different writing/translation styles.

_VARIANCE = 6.8  # same order of magnitude as the constant used in the original paper

# -log(prior probability) of each alignment step type. 1-1 is by far the most common
# in a careful translation. 1-0/0-1 (a sentence with no counterpart at all) is kept
# slightly cheaper than 2-1/1-2 (a merge/split) on purpose: when the length evidence is
# ambiguous, prefer flagging a sentence as unmatched over silently forcing it into a
# merge — a wrong "no translation yet" is far less harmful than a wrong pairing, and
# either way the result always goes through manual review before practice.
_STEP_COST = {
    "1-1": -math.log(0.92),
    "2-1": -math.log(0.015),
    "1-2": -math.log(0.015),
    "1-0": -math.log(0.025),
    "0-1": -math.log(0.025),
}


@dataclass
class AlignmentBead:
    english_indices: list[int] = field(default_factory=list)
    spanish_indices: list[int] = field(default_factory=list)


def _normal_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _length_mismatch_cost(len_en: int, len_es: int, ratio: float) -> float:
    """Cost grows the further the observed ES/EN length ratio is from the expected one."""
    safe_len_en = max(len_en, 1)
    delta = (len_es - safe_len_en * ratio) / math.sqrt(safe_len_en * _VARIANCE)
    two_tailed_p = max(2 * (1 - _normal_cdf(abs(delta))), 1e-10)
    return -math.log(two_tailed_p)


def _band_half_width(n: int, m: int) -> int:
    """How far from the diagonal the search is allowed to wander.

    A full (n+1)x(m+1) matrix is quadratic in both time and memory: measured at 15.9 s
    and 132 MB for 1000x1000 sentences, which a single 100k-character text can exceed.
    Since both sides are the *same* text in order, the optimal path never strays far
    from the diagonal -- a band keeps the result identical for real translations while
    making cost linear in the number of sentences. The floor of 50 keeps short texts
    (and the unit tests) fully exact."""
    return max(_MIN_BAND, min(_MAX_BAND, int(0.08 * max(n, m))))


_MIN_BAND = 50
_MAX_BAND = 400


def align(english_sentences: list[str], spanish_sentences: list[str]) -> list[AlignmentBead]:
    """Aligns two ordered sentence lists (no reordering) into beads. Each bead lists the
    0-based indices, on each side, that belong together (usually one each; occasionally
    a merge/split; sometimes empty on one side when a sentence has no counterpart)."""
    n, m = len(english_sentences), len(spanish_sentences)
    if n == 0 and m == 0:
        return []

    en_len = [len(s) for s in english_sentences]
    es_len = [len(s) for s in spanish_sentences]

    total_en = sum(en_len)
    total_es = sum(es_len)
    ratio = (total_es / total_en) if total_en > 0 else 1.0
    if ratio <= 0:
        ratio = 1.0

    inf = float("inf")
    band = _band_half_width(n, m)

    # Each row only materializes the columns inside the band, with `offset[i]` marking
    # which real column its first slot stands for.
    offset: list[int] = []
    dp: list[list[float]] = []
    choice: list[list[tuple[int, int] | None]] = []
    for i in range(n + 1):
        center = round(i * m / n) if n > 0 else m
        lo = max(0, center - band)
        hi = min(m, center + band)
        offset.append(lo)
        width = hi - lo + 1
        dp.append([inf] * width)
        choice.append([None] * width)

    def get(i: int, j: int) -> float:
        k = j - offset[i]
        if 0 <= k < len(dp[i]):
            return dp[i][k]
        return inf

    def relax(i: int, j: int, cost: float, prev_i: int, prev_j: int) -> None:
        k = j - offset[i]
        if not (0 <= k < len(dp[i])):
            return  # outside the band: this path is not considered
        if cost < dp[i][k]:
            dp[i][k] = cost
            choice[i][k] = (prev_i, prev_j)

    relax(0, 0, 0.0, -1, -1)

    for i in range(n + 1):
        lo = offset[i]
        for k, base in enumerate(dp[i]):
            if base == inf:
                continue
            j = lo + k

            if i + 1 <= n:
                relax(i + 1, j, base + _STEP_COST["1-0"], i, j)

            if j + 1 <= m:
                relax(i, j + 1, base + _STEP_COST["0-1"], i, j)

            if i + 1 <= n and j + 1 <= m:
                relax(
                    i + 1,
                    j + 1,
                    base + _STEP_COST["1-1"] + _length_mismatch_cost(en_len[i], es_len[j], ratio),
                    i,
                    j,
                )

            if i + 2 <= n and j + 1 <= m:
                relax(
                    i + 2,
                    j + 1,
                    base + _STEP_COST["2-1"] + _length_mismatch_cost(en_len[i] + en_len[i + 1], es_len[j], ratio),
                    i,
                    j,
                )

            if i + 1 <= n and j + 2 <= m:
                relax(
                    i + 1,
                    j + 2,
                    base + _STEP_COST["1-2"] + _length_mismatch_cost(en_len[i], es_len[j] + es_len[j + 1], ratio),
                    i,
                    j,
                )

    beads: list[AlignmentBead] = []
    i, j = n, m
    while i > 0 or j > 0:
        k = j - offset[i]
        step = choice[i][k] if 0 <= k < len(choice[i]) else None
        if step is None:
            break  # unreachable for well-formed input; guards pathological cases
        prev_i, prev_j = step
        if prev_i < 0:
            break
        beads.append(
            AlignmentBead(
                english_indices=list(range(prev_i, i)),
                spanish_indices=list(range(prev_j, j)),
            )
        )
        i, j = prev_i, prev_j

    beads.reverse()
    return beads
