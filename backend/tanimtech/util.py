import math


def round_half_up(x):
    """Round .5 upward (Python's round() rounds .5 to the nearest even number)."""
    return int(math.floor(x + 0.5))
