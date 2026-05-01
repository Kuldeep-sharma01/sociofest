import { motion } from "framer-motion";
import { ArrowRight, Users, BookOpen, CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { getWrapperThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    viewport={{ once: true }}
    className="bg-black/5 dark:bg-white/5 border border-inherit/30 backdrop-blur-md rounded-2xl p-6 shadow-lg hover:shadow-xl transition text-inherit"
  >
    <Icon className="w-10 h-10 mb-4 opacity-80 text-inherit" />
    <h3 className="text-lg font-semibold mb-2 text-inherit">{title}</h3>
    <p className="opacity-70 text-sm leading-relaxed text-inherit">{desc}</p>
  </motion.div>
);

const Welcome = () => {
  const navigate = useNavigate();
  const { appTheme } = useTheme();

  return (
    <div className={`flex-1 overflow-auto transition-colors duration-500 ${getWrapperThemeClasses(appTheme)}`}>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-24 text-center sm:text-left">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-6xl font-extrabold leading-tight text-inherit"
        >
          Welcome to <span className="opacity-80">SocioFest</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-6 max-w-2xl text-lg opacity-80 text-inherit mx-auto sm:mx-0"
        >
          A unified academic platform where students, teachers, and departments
          collaborate seamlessly — manage semesters, subjects, events, quizzes,
          and more from one powerful ecosystem.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-10 flex flex-wrap gap-4 justify-center sm:justify-start"
        >
          <button
            onClick={() => navigate("/signup")}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
          >
            Get Started <ArrowRight size={18} />
          </button>

          <button
            onClick={() => navigate("/login")}
            className="border border-inherit/50 px-6 py-3 rounded-xl font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-inherit"
          >
            Login
          </button>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="bg-black/5 dark:bg-white/5 py-24 border-y border-inherit/30 text-inherit">
        <div className="max-w-7xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16 text-inherit"
          >
            Why SocioFest?
          </motion.h2>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Users}
              title="Role-Based Access"
              desc="Clear separation of Student, Teacher, HOD, and Admin roles with real-world academic rules enforced."
              delay={0.1}
            />
            <FeatureCard
              icon={BookOpen}
              title="Smart Subject Mapping"
              desc="Subjects are defined per semester by faculty and automatically available to enrolled students."
              delay={0.2}
            />
            <FeatureCard
              icon={CalendarCheck}
              title="Events & Academics"
              desc="Manage quizzes, events, posts, and department activities in one consistent platform."
              delay={0.3}
            />
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-16 text-center text-inherit bg-black/10 dark:bg-white/10">
        <motion.h3
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-inherit"
        >
          Ready to modernize your campus?
        </motion.h3>

        <p className="mt-4 opacity-80 text-inherit">
          Join SocioFest and experience a smarter academic ecosystem.
        </p>

        <button
          onClick={() => navigate("/signup")}
          className={`mt-8 px-8 py-3 rounded-xl font-bold shadow-sm transition-all active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
        >
          Create Your Account
        </button>
      </div>
    </div>
  );
};

export default Welcome;
