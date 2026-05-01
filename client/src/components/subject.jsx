import { Link } from "react-router-dom";

const Subject = ({ Subjects }) => {
  // ✅ Determine display mode from the full array, not just index 0
  const showTeacher = Array.isArray(Subjects) && Subjects.some(s => s.assignedTeacher !== undefined);

  return (
    <>
      {Array.isArray(Subjects) && Subjects.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex  gap-2">
            <div className="w-full py-2 border transition-colors border-inherit/30 rounded-md text-center font-bold bg-black/10 dark:bg-white/10 text-inherit shadow-sm">
              Subject Name
            </div>
            <div className="w-full py-2 border transition-colors border-inherit/30 rounded-md text-center font-bold bg-black/10 dark:bg-white/10 text-inherit shadow-sm">
              {showTeacher
                ? "Assigned Teacher"
                : "Semester"}
            </div>
          </div>
          {Subjects.map((sub, index) => {
            const hasId = !!sub._id;
            const Content = (
              <>
                <div className="flex gap-2 w-full">
                  <div
                    className={`flex-1 p-2 border transition-colors border-inherit/30 rounded-md text-center font-semibold bg-black/5 dark:bg-white/5 text-inherit ${
                      hasId
                        ? "group-hover:bg-black/10 dark:group-hover:bg-white/10"
                        : "opacity-70"
                    }`}
                  >
                    {sub.name || sub.subject}
                  </div>
                  <div
                    className={`flex-1 p-2 border transition-colors border-inherit/30 rounded-md text-center font-medium bg-black/5 dark:bg-white/5 flex items-center justify-center text-inherit ${
                      hasId
                        ? "group-hover:bg-black/10 dark:group-hover:bg-white/10"
                        : "opacity-70"
                    }`}
                  >
                    {showTeacher
                      ? sub.assignedTeacher?.name || "Not Assigned"
                      : sub.semester
                        ? `Sem ${sub.semester}`
                        : "N/A"}
                  </div>
                </div>
              </>
            );
            return hasId ? (
              <Link
                to={`/subjects/${sub._id}`}
                key={sub._id}
                className="flex gap-2 group hover:no-underline cursor-pointer"
              >
                {Content}
              </Link>
            ) : (
              <div key={index} className="flex gap-2 opacity-80">
                {Content}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default Subject;
