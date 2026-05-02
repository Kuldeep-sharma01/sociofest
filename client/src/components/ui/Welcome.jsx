import React, { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, BookOpen, CalendarCheck, Sparkles, Globe, Shield, Zap, Palette, Box, Check, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme, THEMES } from "@/context/ThemeContext";
import { getWrapperThemeClasses, getPrimaryButtonClasses, getCardThemeClasses } from "@/utils/themeUtils";

const TiltCard = ({ children, className }) => {
  return (
    <div className={`card-3d ${className}`}>
      {children}
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, delay }) => {
  const { appTheme } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      className="group relative"
    >
      <TiltCard className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-3xl p-8 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500`}>
        <div className="flex flex-col h-full">
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 w-fit group-hover:bg-indigo-500/20 transition-colors duration-500">
            <Icon className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-inherit group-hover:translate-z-10 transition-transform">{title}</h3>
          <p className="opacity-70 text-sm leading-relaxed text-inherit">{desc}</p>
          
          <div className="mt-8 flex items-center gap-2 text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            Learn More <ArrowRight size={14} />
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
};

const FloatingBlob = ({ color, size, initialPos, animatePos, duration }) => (
  <motion.div
    className={`absolute rounded-full blur-[120px] opacity-20 dark:opacity-30 pointer-events-none z-0`}
    style={{
      backgroundColor: color,
      width: size,
      height: size,
      left: initialPos.x,
      top: initialPos.y,
    }}
    animate={{
      x: [0, animatePos.x, 0],
      y: [0, animatePos.y, 0],
      scale: [1, 1.2, 1],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const Welcome = () => {
  const navigate = useNavigate();
  const { appTheme, setAppTheme, isDark, toggleTheme, is3DMode, toggle3DMode } = useTheme();
  const [showThemePanel, setShowThemePanel] = useState(false);

  return (
    <div className={`flex-1 overflow-x-hidden relative transition-all duration-1000 ${getWrapperThemeClasses(appTheme)}`}>
      
      {/* 3D Perspective Wrapper - Local removed, now handled globally in App.jsx */}
      <div className="min-h-screen relative overflow-hidden bg-inherit">
        {/* Background Blobs */}
        <FloatingBlob 
          color="#6366f1" 
          size="40vw" 
          initialPos={{ x: "-10%", y: "10%" }} 
          animatePos={{ x: 100, y: 50 }} 
          duration={15} 
        />
        <FloatingBlob 
          color="#a855f7" 
          size="35vw" 
          initialPos={{ x: "60%", y: "-5%" }} 
          animatePos={{ x: -150, y: 100 }} 
          duration={18} 
        />
        <FloatingBlob 
          color="#ec4899" 
          size="30vw" 
          initialPos={{ x: "20%", y: "60%" }} 
          animatePos={{ x: 200, y: -100 }} 
          duration={20} 
        />

        <div className="relative z-10">
          {/* Hero Section */}
          <section className="min-h-screen flex flex-col items-center justify-center px-6 relative">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
              
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-center lg:text-left"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold mb-8 border border-indigo-500/20 backdrop-blur-md"
                >
                  <Sparkles size={14} /> The Next Generation Campus
                </motion.div>
                
                <h1 className="text-6xl md:text-8xl font-black leading-[1.1] text-inherit tracking-tight mb-8">
                  Your Campus, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-gradient-x">
                    Unified.
                  </span>
                </h1>

                <p className="text-lg md:text-xl opacity-70 text-inherit mb-12 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Experience a smarter academic ecosystem. SocioFest brings students, teachers, and departments together in one high-performance platform.
                </p>

                <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/signup")}
                    className={`px-10 py-5 rounded-2xl font-black text-lg flex items-center gap-3 shadow-2xl shadow-indigo-500/20 transition-all ${getPrimaryButtonClasses(appTheme)}`}
                  >
                    Join the Fest <ArrowRight size={22} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/login")}
                    className="px-10 py-5 rounded-2xl font-black text-lg border-2 border-inherit/20 backdrop-blur-md hover:bg-black/5 dark:hover:bg-white/5 transition-all text-inherit"
                  >
                    Sign In
                  </motion.button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="hidden lg:block relative"
              >
                <TiltCard className="w-full aspect-square max-w-[500px] mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-3xl rounded-[3rem] border border-white/20 shadow-[0_0_100px_-20px_rgba(99,102,241,0.5)] flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                  <motion.div
                    animate={{ 
                      y: [0, -20, 0],
                      rotateY: [0, 10, 0],
                      rotateX: [0, -5, 0]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 flex flex-col items-center gap-8"
                  >
                    <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center shadow-2xl border border-white/20">
                      <Globe className="w-24 h-24 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
                        <Zap className="w-8 h-8 text-yellow-400 mb-2" />
                        <div className="h-2 w-12 bg-white/30 rounded-full" />
                      </div>
                      <div className="px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
                        <Shield className="w-8 h-8 text-blue-400 mb-2" />
                        <div className="h-2 w-12 bg-white/30 rounded-full" />
                      </div>
                    </div>
                  </motion.div>
                </TiltCard>
                
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
              </motion.div>
            </div>
          </section>

          {/* Features Grid */}
          <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-24">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-4xl md:text-5xl font-black text-inherit mb-6"
                >
                  Engineered for Excellence
                </motion.h2>
                <p className="text-lg opacity-60 max-w-2xl mx-auto">
                  Discover the features that make SocioFest the ultimate choice for modern educational institutions.
                </p>
              </div>

              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                <FeatureCard
                  icon={Users}
                  title="Dynamic Roles"
                  desc="Granular permissions for Students, Teachers, HODs, and Admins. Each role gets a tailored experience."
                  delay={0.1}
                />
                <FeatureCard
                  icon={BookOpen}
                  title="Academic Hub"
                  desc="Smart curriculum mapping, real-time assignment tracking, and automated progress analytics."
                  delay={0.2}
                />
                <FeatureCard
                  icon={CalendarCheck}
                  title="Event Sphere"
                  desc="Never miss a beat. Quizzes, department meetings, and campus fests all in one unified calendar."
                  delay={0.3}
                />
              </div>
            </div>
          </section>

          {/* Floating Call to Action */}
          <section className="py-40 px-6 overflow-hidden relative">
            <div className="max-w-5xl mx-auto relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className={`${getCardThemeClasses(appTheme)} p-12 md:p-24 rounded-[3.5rem] text-center border border-white/10 shadow-2xl relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                
                <h2 className="text-4xl md:text-6xl font-black mb-8 text-inherit">
                  Ready to Join the Fest?
                </h2>
                <p className="text-xl opacity-70 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Transform your campus experience today. Join thousands of users already thriving on SocioFest.
                </p>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/signup")}
                  className={`px-12 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all ${getPrimaryButtonClasses(appTheme)}`}
                >
                  Start Your Journey
                </motion.button>
              </motion.div>
            </div>
          </section>

          {/* Simple Footer */}
          <footer className="py-12 border-t border-inherit/10 text-center opacity-50 text-sm font-medium">
            <p>© {new Date().getFullYear()} SocioFest. Crafted for the future of education.</p>
          </footer>
        </div>
      </div>

      {/* --- Floating Control Panel --- */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
        <AnimatePresence>
          {showThemePanel && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={`${getCardThemeClasses(appTheme)} backdrop-blur-2xl border border-white/20 p-4 rounded-3xl shadow-2xl w-64 mb-2`}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-xs font-black uppercase tracking-wider opacity-60">Customizer</span>
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-60 pr-1 custom-scrollbar">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAppTheme(t.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all ${appTheme === t.id ? "bg-indigo-500 text-white font-bold" : "hover:bg-white/5 opacity-80 hover:opacity-100"}`}
                  >
                    {t.name}
                    {appTheme === t.id && <Check size={14} />}
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={toggle3DMode}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all ${is3DMode ? "bg-purple-500 text-white font-bold shadow-lg shadow-purple-500/20" : "bg-white/5 opacity-80 hover:opacity-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <Box size={16} /> Global 3D Mode
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${is3DMode ? "bg-white/30" : "bg-white/10"}`}>
                    <motion.div 
                      animate={{ x: is3DMode ? 18 : 2 }}
                      className="absolute top-1 left-0 w-2 h-2 rounded-full bg-white"
                    />
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowThemePanel(!showThemePanel)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-xl border border-white/20 transition-all ${showThemePanel ? "bg-indigo-500 text-white" : "bg-white/10 text-inherit hover:bg-white/20"}`}
        >
          {showThemePanel ? <Check size={24} /> : <Palette size={24} />}
        </motion.button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-2000px { perspective: 2000px; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
      `}} />
    </div>
  );
};

export default Welcome;
