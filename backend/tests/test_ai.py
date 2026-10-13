def test_ai_smoke_returns_two_plus_two_answer(client):
    response = client.get("/api/ai/smoke")
    assert response.status_code == 200

    answer = response.json()["answer"].lower()
    assert "4" in answer or "four" in answer
