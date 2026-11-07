"""Test API : routes FastAPI filtrées par période, réponses attendues et entrées invalides."""

import pytest


def test_observations_filtered_by_period(client):
    response = client.get("/api/v1/indices/oni/observations?start=2000-06&end=2000-08")

    assert response.status_code == 200
    body = response.json()
    assert body["index"] == "ONI"
    assert body["unit"] == "°C"
    assert body["source"]["organization"] == "NOAA Climate Prediction Center (CPC)"
    assert body["count"] == 3
    assert [o["season"] for o in body["observations"]] == ["MJJ", "JJA", "JAS"]
    assert [o["anomaly"] for o in body["observations"]] == [0.9, 1.2, 1.6]


def test_observations_without_filter_returns_whole_series(client):
    body = client.get("/api/v1/indices/ONI/observations").json()
    assert body["count"] == 36


@pytest.mark.parametrize(
    "query",
    ["start=2000-13", "start=2000/01", "end=abcd", "start=2000-1"],
)
def test_observations_rejects_invalid_month_format(client, query):
    response = client.get(f"/api/v1/indices/oni/observations?{query}")
    assert response.status_code == 422


def test_observations_rejects_inverted_period(client):
    response = client.get("/api/v1/indices/oni/observations?start=2001-01&end=2000-01")
    assert response.status_code == 422
    assert "postérieur" in response.json()["detail"]


def test_unknown_index_returns_404(client):
    response = client.get("/api/v1/indices/xyz/observations")
    assert response.status_code == 404


def test_episodes_detection(client):
    body = client.get("/api/v1/indices/oni/episodes").json()
    episodes = body["episodes"]

    assert [e["kind"] for e in episodes] == ["el_nino", "la_nina"]
    nino, nina = episodes
    assert (nino["start"], nino["end"], nino["seasons"]) == ("2000-03-01", "2000-11-01", 9)
    assert (nino["peak"], nino["peak_label"], nino["intensity"]) == (1.6, "JAS 2000", "fort")
    assert (nina["seasons"], nina["peak"], nina["intensity"]) == (7, -1.3, "modéré")


def test_compare_two_periods(client):
    response = client.get(
        "/api/v1/indices/oni/compare?a_start=2000-03&a_end=2000-11&b_start=2002-01&b_end=2002-07"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["a"]["dominant_phase"] == "el_nino"
    assert body["b"]["dominant_phase"] == "la_nina"
    assert len(body["aligned"]) == 9
    assert body["aligned"][8] == {"offset": 8, "a": 0.7, "b": None}
    assert any("plus élevé de 0,30" in line for line in body["interpretation"])
    assert body["caveats"]


def test_compare_rejects_missing_parameters(client):
    response = client.get("/api/v1/indices/oni/compare?a_start=2000-03&a_end=2000-11")
    assert response.status_code == 422


def test_index_list_exposes_traceability(client):
    [index] = client.get("/api/v1/indices").json()
    assert index["last_import"]["rows_inserted"] == 36
    assert len(index["last_import"]["file_sha256"]) == 64
    assert (index["first_period"], index["last_period"]) == ("2000-01-01", "2002-12-01")
