from datetime import date

from app.services.episodes import Point, detect_episodes, interpret, summarize


def series(values, start_year=2000):
    seasons = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]
    points = []
    for i, value in enumerate(values):
        year, month = start_year + i // 12, i % 12 + 1
        points.append(Point(date(year, month, 1), seasons[month - 1], year, value))
    return points


def test_four_seasons_are_not_an_episode():
    assert detect_episodes(series([0.6, 0.7, 0.8, 0.9, 0.2])) == []


def test_five_seasons_make_an_episode():
    [episode] = detect_episodes(series([0.6, 0.7, 2.1, 0.9, 0.5, 0.2]))
    assert episode.kind == "el_nino"
    assert episode.seasons == 5
    assert episode.intensity == "très fort"
    assert not episode.ongoing


def test_episode_reaching_end_of_series_is_flagged_ongoing():
    [episode] = detect_episodes(series([0.0, -0.5, -0.6, -0.7, -0.8, -0.9]))
    assert episode.kind == "la_nina"
    assert episode.ongoing


def test_gap_in_series_splits_runs():
    points = series([0.6, 0.7, 0.8]) + series([0.6, 0.7, 0.8], start_year=2005)
    assert detect_episodes(points) == []


def test_close_peaks_are_not_ranked():
    a = summarize(series([1.0, 2.0, 1.5]))
    b = summarize(series([1.1, 1.95, 1.2]))
    assert any("très proches" in line for line in interpret(a, b))
