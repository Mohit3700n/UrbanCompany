from app.routes.ai import add_vendor_recommendations


def test_recommends_ranked_vendor_with_database_facts():
    vendors = [
        {
            "vendor_id": 1,
            "distance_km": 2.5,
            "average_rating": 4.5,
            "total_reviews": 2,
            "completed_jobs": 3,
            "ranking_breakdown": {
                "matched_skill_terms": ["pipe repair"],
            },
        },
        {
            "vendor_id": 2,
            "distance_km": 4.0,
            "average_rating": 0.0,
            "total_reviews": 0,
            "completed_jobs": 0,
            "ranking_breakdown": {
                "matched_skill_terms": [],
            },
        },
    ]

    result = add_vendor_recommendations(vendors, "Plumber")

    assert result[0]["is_recommended"] is True
    assert result[1]["is_recommended"] is False
    assert "Listed for Plumber" in result[0]["recommendation_reasons"]
    assert "Relevant experience: pipe repair" in result[0]["recommendation_reasons"]
    assert "4.5/5 from 2 customer reviews" in result[0]["recommendation_reasons"]
    assert "3 completed services" in result[0]["recommendation_reasons"]
    assert not any("reviews" in reason for reason in result[1]["recommendation_reasons"])


def test_empty_vendor_list_has_no_recommendation():
    assert add_vendor_recommendations([], "Plumber") == []
