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
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    # choice[i][j] = (step_type, previous_i, previous_j) that produced dp[i][j]
    choice: list[list[tuple[str, int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(n + 1):
        for j in range(m + 1):
            base = dp[i][j]
            if base == inf:
                continue

            if i + 1 <= n:
                cost = base + _STEP_COST["1-0"]
                if cost < dp[i + 1][j]:
                    dp[i + 1][j] = cost
                    choice[i + 1][j] = ("1-0", i, j)

            if j + 1 <= m:
                cost = base + _STEP_COST["0-1"]
                if cost < dp[i][j + 1]:
                    dp[i][j + 1] = cost
                    choice[i][j + 1] = ("0-1", i, j)

            if i + 1 <= n and j + 1 <= m:
                cost = base + _STEP_COST["1-1"] + _length_mismatch_cost(en_len[i], es_len[j], ratio)
                if cost < dp[i + 1][j + 1]:
                    dp[i + 1][j + 1] = cost
                    choice[i + 1][j + 1] = ("1-1", i, j)

            if i + 2 <= n and j + 1 <= m:
                cost = base + _STEP_COST["2-1"] + _length_mismatch_cost(
                    en_len[i] + en_len[i + 1], es_len[j], ratio
                )
                if cost < dp[i + 2][j + 1]:
                    dp[i + 2][j + 1] = cost
                    choice[i + 2][j + 1] = ("2-1", i, j)

            if i + 1 <= n and j + 2 <= m:
                cost = base + _STEP_COST["1-2"] + _length_mismatch_cost(
                    en_len[i], es_len[j] + es_len[j + 1], ratio
                )
                if cost < dp[i + 1][j + 2]:
                    dp[i + 1][j + 2] = cost
                    choice[i + 1][j + 2] = ("1-2", i, j)

    beads: list[AlignmentBead] = []
    i, j = n, m
    while i > 0 or j > 0:
        step = choice[i][j]
        if step is None:
            break  # unreachable for well-formed input; guards pathological cases
        _step_type, prev_i, prev_j = step
        beads.append(
            AlignmentBead(
                english_indices=list(range(prev_i, i)),
                spanish_indices=list(range(prev_j, j)),
            )
        )
        i, j = prev_i, prev_j

    beads.reverse()
    return beads
