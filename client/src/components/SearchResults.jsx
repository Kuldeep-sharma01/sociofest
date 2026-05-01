import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, Link } from "react-router-dom";
import {
  User,
  Calendar,
  Search as SearchIcon,
  MapPin,
  ArrowRight,
  Award,
  FileText,
  Building2,
  Book,
  ClipboardList,
  ShoppingBag,
  Image as ImageIcon,
  Video
} from "lucide-react";
import { useSelector } from "react-redux";
import PostCard from "@/components/ui/PostCard";
import FullscreenMediaModal from "@/components/ui/FullscreenMediaModal";
import CertificateCard from "@/components/ui/CertificateCard";
import UserCard from "@/components/ui/UserCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import AssignmentCard from "@/components/ui/AssignmentCard";
import { globalSearch } from "@/services/searchService";
import { downloadCertificate } from "@/services/certificateService";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const user = useSelector((state) => state.auth.user);
  const { appTheme } = useTheme();

  const [results, setResults] = useState({
    users: [],
    events: [],
    quizzes: [],
    certificates: [],
    posts: [],
    materials: [],
    departments: [],
    subjects: [],
    assignments: [],
    products: [],
    aiMedia: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [fullscreenMedia, setFullscreenMedia] = useState(null);

  // Quick Suggestion Labels
  const suggestions = [
    { label: "My Certificates", tab: "certificates" },
    { label: "Active Quizzes", tab: "quizzes" },
    { label: "Campus Events", tab: "events" },
    { label: "People", tab: "people" },
    { label: "Marketplace", tab: "products" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!query) return;
      setLoading(true);
      try {
        const data = await globalSearch(query, false);

        const localAiMedia = JSON.parse(localStorage.getItem("ai_image_gallery") || "[]");
        const filteredAiMedia = localAiMedia.filter(img =>
          (img.prompt || "").toLowerCase().includes(query.toLowerCase()) ||
          (img.provider || "").toLowerCase().includes(query.toLowerCase())
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setResults({
          users: Array.isArray(data.users) ? data.users : [],
          events: Array.isArray(data.events)
            ? data.events.filter((e) => e.category !== "Notification")
            : [],
          quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
          certificates: Array.isArray(data.certificates)
            ? data.certificates
            : [],
          posts: Array.isArray(data.posts) ? data.posts : [],
        materials: Array.isArray(data.materials) ? data.materials : [],
          departments: Array.isArray(data.departments) ? data.departments : [],
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          assignments: Array.isArray(data.assignments) ? data.assignments : [],
          products: Array.isArray(data.products) ? data.products : [],
          aiMedia: filteredAiMedia,
        });
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query]);

  const handleDownloadCertificate = async (certId, title) => {
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Generating certificate... ⏳",
        }),
      );
      await downloadCertificate(certId);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Certificate downloaded! 🎉" }),
      );
    } catch (err) {
      console.error("Certificate download failed:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to download certificate. ❌";
      window.dispatchEvent(new CustomEvent("showToast", { detail: errorMsg }));
    }
  };

  const TabButton = ({ id, label, count }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
        activeTab === id
          ? `${getPrimaryButtonClasses(appTheme)} shadow-md`
          : "bg-black/5 dark:bg-white/5 text-inherit border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10"
      }`}
    >
      {label} {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
    </button>
  );

  const totalResults =
    results.users.length +
    results.events.length +
    results.quizzes.length +
    results.certificates.length +
    results.posts.length +
    results.materials.length +
    results.departments.length +
    results.subjects.length +
    results.assignments.length +
    results.products.length +
    results.aiMedia.length;

  return (
    <div className="max-w-5xl mx-auto p-6 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 opacity-70 text-inherit text-sm mb-2">
          <SearchIcon className="w-4 h-4" />
          <span>Search Results for</span>
        </div>
        <h1 className="text-3xl font-bold text-inherit">"{query}"</h1>
      </div>

      {/* Quick Suggestion Labels */}
      {/* <div className="flex flex-wrap gap-2 mb-6">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => setActiveTab(s.tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 rounded-lg text-xs font-medium transition-colors border border-transparent hover:border-blue-200"
          >
            <Tag className="w-3 h-3" />
            {s.label}
          </button>
        ))}
      </div> */}

      {/* Tabs */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
        <TabButton id="all" label="All" count={totalResults} />
        <TabButton id="posts" label="Posts & Media" count={results.posts.length} />
        <TabButton id="people" label="People" count={results.users.length} />
        <TabButton id="events" label="Events" count={results.events.length} />
        <TabButton
          id="quizzes"
          label="Quizzes"
          count={results.quizzes.length}
        />
        <TabButton
          id="certificates"
          label="Certificates"
          count={results.certificates.length}
        />
        <TabButton id="departments" label="Departments" count={results.departments.length} />
        <TabButton id="subjects" label="Subjects" count={results.subjects.length} />
        <TabButton id="assignments" label="Assignments" count={results.assignments.length} />
        <TabButton id="products" label="Marketplace" count={results.products.length} />
        <TabButton id="aimedia" label="AI Media" count={results.aiMedia.length} />
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : (
        <div className="flex flex-col gap-8">
          {/* No Results State */}
          {totalResults === 0 && (
            <div className={`text-center py-20 rounded-2xl border border-dashed border-inherit/30 ${getCardThemeClasses(appTheme)}`}>
              <SearchIcon className="w-16 h-16 opacity-30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-inherit">
                No results found
              </h3>
              <p className="opacity-70 text-inherit mt-2">
                We couldn't find anything matching "{query}"
              </p>
            </div>
          )}

          {/* Posts & Media Section */}
          {(activeTab === "all" || activeTab === "posts") &&
            results.posts.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <FileText className="text-current opacity-80" /> Posts & Media
                </h2>
                <div className="columns-1 md:columns-2 gap-4 w-full">
                  {results.posts.map((post) => {
                    if (post.material?.description && post.material.description.startsWith("[LECTURE]")) {
                      const contentParts = post.material.description.split("\n\n");
                      const metaString = contentParts[0].replace("[LECTURE]", "");
                      const description = contentParts.slice(1).join("\n\n");

                      const parts = metaString.split("|");
                      let title = parts[0]?.trim() || "Untitled";
                      let subjectLabel = parts[1]?.trim() || "General";
                      let views = parseInt(parts[2]) || 0;
                      let englishAttachmentUrl = parts[3] && parts[3].trim() !== "none" ? parts[3].trim() : "";
                      let hindiAttachmentUrl = parts[4] && parts[4].trim() !== "none" ? parts[4].trim() : "";
                      let isDownloadable = parts[5] === "true";

                      let mediaUrl = null;
                      let mediaType = null;
                      if (post.material?.media?.length > 0) {
                        const m = post.material.media[0];
                        const mPath = typeof m === "string" ? m : m.path;
                        mediaUrl = mPath?.startsWith("http") ? mPath : `/${mPath}`;
                        mediaType = m.mimetype?.startsWith("video") || m.mimetype === "youtube" ? "video" : "image";
                      }

                      if (title === "English" || title === "Hindi") title = "Legacy Material";

                      const lectureObj = { ...post, title, subjectLabel, description, likes: post.reactions?.length || 0, views, englishAttachmentUrl, hindiAttachmentUrl, isDownloadable, mediaUrl, mediaType };

                      return (
                        <div key={post._id} className="break-inside-avoid mb-4">
                          <PostCard
                            post={lectureObj}
                            currentUser={user}
                            setFullscreenMedia={setFullscreenMedia}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={post._id} className="break-inside-avoid mb-4">
                        <PostCard
                          post={post}
                          currentUser={user}
                          setFullscreenMedia={setFullscreenMedia}
                          hideHeader={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {/* Certificates Section */}
          {(activeTab === "all" || activeTab === "certificates") &&
            results.certificates.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <Award className="text-current opacity-80" /> My Certificates
                </h2>
                <div className="grid md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
                  {results.certificates.map((cert) => (
                    <CertificateCard
                      key={cert._id}
                      cert={cert}
                      onDownload={handleDownloadCertificate}
                    />
                  ))}
                </div>
              </section>
            )}

          {/* Quizzes Section */}
          {(activeTab === "all" || activeTab === "quizzes") &&
            results.quizzes.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <FileText className="text-current opacity-80" /> Quizzes
                </h2>
                <div className="grid md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
                  {results.quizzes.map((quiz) => (
                    <Link
                      key={quiz._id}
                      to={
                        user?.role === "Student"
                          ? `/quiz/attempt/${quiz._id}`
                          : `/teacher/quiz-editor?id=${quiz._id}`
                      }
                      className={`flex flex-col p-5 rounded-2xl shadow-sm border transition-all hover:shadow-md hover:-translate-y-0.5 hover:no-underline group ${getCardThemeClasses(appTheme)}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        {quiz.isActive ? (
                          <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-md">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-black/10 dark:bg-white/10 text-inherit text-xs font-bold rounded-md border border-inherit/20">
                            Closed
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-inherit opacity-90 group-hover:opacity-100 transition-opacity mb-1 line-clamp-1">
                        {quiz.title}
                      </h3>
                      <p className="text-sm opacity-70 text-inherit mb-4 font-medium truncate">
                        {quiz.subjectName || quiz.subject}
                      </p>
                      <div className="mt-auto pt-3 border-t border-inherit/20 flex items-center justify-between text-xs opacity-70 font-semibold text-inherit">
                        <span>
                          Starts:{" "}
                          {new Date(quiz.startDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 group-hover:text-orange-500 transition-colors">
                          View Quiz <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          {/* Study Materials Section */}
          {(activeTab === "all" || activeTab === "materials") &&
            results.materials.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <FileText className="text-current opacity-80" /> Study Materials
                </h2>
                <div className="columns-1 md:columns-2 gap-4 w-full">
                  {results.materials.map((m) => (
                    <div key={m._id} className="break-inside-avoid mb-4">
                      <PostCard
                        post={{
                          ...m,
                          material: m,
                          subjectLabel: m.subject?.name || "General",
                          content: m.description,
                          isDownloadable: true
                        }}
                        currentUser={user}
                        setFullscreenMedia={setFullscreenMedia}
                        hideHeader={false}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* People Section */}
          {(activeTab === "all" || activeTab === "people") &&
            results.users.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <User className="text-current opacity-80" /> People
                </h2>
                <div className="grid md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
                  {results.users.map((user) => (
                    <UserCard
                      key={user._id}
                      user={user}
                      to={`/profile/${user._id}`}
                      subtitle={
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 bg-black/10 dark:bg-white/10 text-inherit border border-inherit/20 text-xs font-bold rounded-full">{user.role}</span>
                          {user.department && (
                            <span className="text-xs opacity-70 font-medium text-inherit">
                              • {user.department.name}
                            </span>
                          )}
                        </div>
                      }
                      avatarSize="w-12 h-12 text-lg"
                      className="p-4 bg-transparent border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
                      rightElement={
                        <ArrowRight className="w-4 h-4 opacity-30 text-inherit -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                      }
                    />
                  ))}
                </div>
              </section>
            )}

          {/* Events Section */}
          {(activeTab === "all" || activeTab === "events") &&
            results.events.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <Calendar className="text-current opacity-80" /> Events
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
                  {results.events.map((event) => {
                    const eventDate = new Date(event.start);
                    return (
                      <div
                        key={event._id}
                        className={`p-0 rounded-2xl shadow-sm border flex flex-row overflow-hidden hover:shadow-md transition-all group ${getCardThemeClasses(appTheme)}`}
                      >
                        <div className="bg-indigo-500 text-white p-4 flex flex-col items-center justify-center min-w-[80px] shrink-0">
                          <span className="text-xs font-bold uppercase tracking-wider opacity-80">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-2xl font-black leading-none">{eventDate.getDate()}</span>
                        </div>
                        <div className="p-4 flex flex-col flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="px-2 py-0.5 bg-black/10 dark:bg-white/10 text-inherit border border-inherit/20 text-[10px] font-bold rounded-md uppercase tracking-wider">
                              {event.category}
                            </span>
                          </div>
                          <h3 className="font-bold text-lg text-inherit mb-1 line-clamp-1">
                            {event.title}
                          </h3>
                          <p className="text-sm opacity-80 text-inherit line-clamp-2 mb-3">
                            {event.description}
                          </p>
                          <div className="flex items-center gap-2 mt-auto text-xs opacity-70 font-semibold text-inherit">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {event.location || "Campus"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {/* Departments Section */}
          {(activeTab === "all" || activeTab === "departments") &&
            results.departments.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <Building2 className="text-current opacity-80" /> Departments
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.departments.map((dept) => (
                    <div key={dept._id} className={`p-5 rounded-2xl shadow-sm border flex items-center gap-4 ${getCardThemeClasses(appTheme)}`}>
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-inherit text-lg leading-tight mb-1 truncate">{dept.name} <span className="opacity-60 text-sm font-normal">({dept.code})</span></h3>
                        {dept.description && <p className="text-sm opacity-80 line-clamp-1">{dept.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Subjects Section */}
          {(activeTab === "all" || activeTab === "subjects") &&
            results.subjects.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <Book className="text-current opacity-80" /> Subjects
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.subjects.map((sub) => (
                    <Link key={sub._id} to={`/subjects/${sub._id}`} className={`p-5 rounded-2xl shadow-sm border hover:shadow-md transition-all hover:no-underline flex items-center gap-4 group ${getCardThemeClasses(appTheme)}`}>
                      <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Book className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-inherit text-lg leading-tight mb-1 truncate">{sub.name} {sub.code ? <span className="opacity-60 text-sm font-normal">({sub.code})</span> : ""}</h3>
                        <p className="text-sm opacity-80 font-medium truncate">{sub.department?.name || "Unknown Dept"}</p>
                      </div>
                      <div className="shrink-0 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-inherit/20">
                        <span className="text-xs font-bold text-inherit opacity-80">Sem {sub.semester}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          {/* Assignments Section */}
          {(activeTab === "all" || activeTab === "assignments") &&
            results.assignments.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <ClipboardList className="text-current opacity-80" /> Assignments
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.assignments.map((assignment) => (
                    <Link key={assignment._id} to={`/subjects/${assignment.subject?._id}`} className="block hover:no-underline">
                      <AssignmentCard
                        title={assignment.title}
                        subjectName={assignment.subject?.name || "Unknown"}
                        dueDate={assignment.dueDate}
                        description={assignment.material?.description}
                        media={assignment.material?.media}
                        onDownloadFile={(url, title) => {
                           const matchedMedia = assignment.material?.media?.find(m => (m.path?.startsWith("http") ? m.path : `/${m.path}`) === url);
                           setFullscreenMedia({
                             url,
                             title,
                             isDownloadable: matchedMedia?.isDownloadable ?? true,
                             authorId: assignment.author?._id || assignment.author,
                             type: matchedMedia?.mimetype?.startsWith("video") ? "video" : matchedMedia?.mimetype?.startsWith("image") ? "image" : "document"
                           });
                        }}
                      />
                    </Link>
                  ))}
                </div>
              </section>
            )}

          {/* Products Section */}
          {(activeTab === "all" || activeTab === "products") &&
            results.products.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <ShoppingBag className="text-current opacity-80" /> Marketplace
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {results.products.map((product) => {
                    const imgPath = product.images?.[0];
                    const safePath = imgPath ? (typeof imgPath === "string" ? imgPath : imgPath.path) : "";
                    const src = safePath ? (safePath.startsWith("http") ? safePath : `/${safePath.replace(/\\/g, "/")}`) : null;
                    
                    return (
                      <Link
                        key={product._id}
                        to={`/marketplace?q=${encodeURIComponent(product.title)}`}
                        className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all flex flex-col group relative block hover:no-underline`}
                      >
                        <div className="relative h-48 bg-black/5 dark:bg-white/5 overflow-hidden">
                          {src ? (
                            <img
                              src={src}
                              alt={product.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-30">
                              <ShoppingBag className="w-16 h-16" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white font-bold px-3 py-1 rounded-lg text-sm border border-white/20">
                            ₹{product.price}
                          </div>
                          <div className="absolute top-2 left-2 bg-white/90 dark:bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                            {product.category}
                          </div>
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-bold text-lg leading-tight mb-2 text-inherit line-clamp-2">{product.title}</h3>
                          <p className="text-sm opacity-80 mb-4 line-clamp-2">{product.description}</p>
                          <div className="mt-auto flex items-center gap-2">
                            <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-xs font-semibold">{product.condition}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

          {/* AI Media Section */}
          {(activeTab === "all" || activeTab === "aimedia") &&
            results.aiMedia.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
                  <ImageIcon className="text-current opacity-80" /> AI Generated Media
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {results.aiMedia.map((img) => (
                    <div
                      key={img.id}
                      className="group relative rounded-xl overflow-hidden shadow-sm border transition-all duration-300 bg-black/5 dark:bg-white/5 border-inherit/30 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                      onClick={() => setFullscreenMedia({ url: img.url, type: img.type || (img.url.startsWith("data:video") ? "video" : "image"), title: img.prompt || "AI Generated Media", isDownloadable: true })}
                    >
                      {img.type === "video" ? (
                        <div className="w-full aspect-square relative">
                          <video src={img.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={img.url} alt={img.prompt} className="w-full h-auto object-cover aspect-square transition-transform duration-500 group-hover:scale-105" style={{ aspectRatio: img.aspectRatio ? img.aspectRatio.replace(':', '/') : "1/1" }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3 transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                        <p className="text-white text-xs font-medium line-clamp-2 mb-2 text-shadow">{img.prompt}</p>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded">{img.provider}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>
      )}

      {fullscreenMedia && createPortal(
        <div className="fixed inset-0 z-[10000]">
          <FullscreenMediaModal
            media={fullscreenMedia}
            onClose={() => setFullscreenMedia(null)}
            currentUser={user}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchResults;
