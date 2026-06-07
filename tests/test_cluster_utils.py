"""Tests pour cluster_utils.py — pur Python, zéro dépendance QGIS."""

import pytest

from QGISIA2.cluster_utils import centroids, dbscan


class TestDbscan:
    def test_two_distant_clusters(self) -> None:
        cluster_a = [(0.0, 0.0), (0.0, 1.0), (1.0, 0.0), (1.0, 1.0)]
        cluster_b = [(10.0, 10.0), (10.0, 11.0), (11.0, 10.0), (11.0, 11.0)]
        points = cluster_a + cluster_b
        labels = dbscan(points, eps=2.0, min_pts=3)
        # Aucun bruit attendu
        assert all(lbl != -1 for lbl in labels)
        # Deux clusters distincts
        unique_labels = set(labels)
        assert len(unique_labels) == 2

    def test_isolated_point_is_noise(self) -> None:
        points = [(0.0, 0.0)]
        labels = dbscan(points, eps=1.0, min_pts=2)
        assert labels == [-1]

    def test_single_cluster(self) -> None:
        points = [(0.0, 0.0), (0.1, 0.1), (0.2, 0.0)]
        labels = dbscan(points, eps=0.5, min_pts=2)
        assert all(lbl == 0 for lbl in labels)


class TestCentroids:
    def test_centroids_match_cluster_count(self) -> None:
        cluster_a = [(0.0, 0.0), (0.0, 2.0)]
        cluster_b = [(10.0, 10.0), (10.0, 12.0)]
        points = cluster_a + cluster_b
        labels = dbscan(points, eps=2.0, min_pts=2)
        c = centroids(points, labels)
        unique_labels = {lbl for lbl in labels if lbl != -1}
        assert len(c) == len(unique_labels)

    def test_centroid_values(self) -> None:
        points = [(0.0, 0.0), (2.0, 0.0)]
        labels = [0, 0]
        c = centroids(points, labels)
        assert c[0] == pytest.approx((1.0, 0.0), abs=1e-6)

    def test_noise_ignored(self) -> None:
        points = [(0.0, 0.0), (100.0, 100.0)]
        labels = [0, -1]
        c = centroids(points, labels)
        assert c == {0: (0.0, 0.0)}
