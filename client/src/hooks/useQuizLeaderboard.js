import { useEffect, useState } from "react";
import { getQuizLeaderboard } from "@/services/quizService";

const useQuizLeaderboard = (selectedQuiz, initialPage = 1) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    setPage(initialPage);
  }, [selectedQuiz?.quizId, initialPage]);

  useEffect(() => {
    if (!selectedQuiz) {
      setLeaderboard([]);
      setTotalPages(1);
      return;
    }

    let isMounted = true;

    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      try {
        const res = await getQuizLeaderboard(selectedQuiz.quizId, page);
        if (!isMounted) return;
        setLeaderboard(res.leaderboard || []);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
        if (isMounted) {
          setLeaderboard([]);
          setTotalPages(1);
        }
      } finally {
        if (isMounted) setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [selectedQuiz, page]);

  return {
    leaderboard,
    page,
    setPage,
    totalPages,
    loadingLeaderboard,
  };
};

export default useQuizLeaderboard;
