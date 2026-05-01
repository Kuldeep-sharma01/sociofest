import { UserCircle, Edit } from "lucide-react";
import Signup from "@/pages/Signup";
import InfoItem from "@/components/ui/InfoItem";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const ProfileSection = ({
  title = "Profile Details",
  icon: Icon = UserCircle,
  iconColorClass = "text-current opacity-80",
  profile,
  editMode,
  setEditMode,
  canEdit,
  handleUpdateProfile,
  updating,
  infoItems = [],
  signupInitialData,
  customHeaderActions,
}) => {
  const { appTheme } = useTheme();

  return (
    <div className={`p-6 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
          <Icon className={`${iconColorClass} w-7 h-7`} /> {title}
        </h2>
        <div className="flex items-center gap-2">
          {customHeaderActions}
          {canEdit && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 rounded-xl font-semibold shadow-sm transition-all"
            >
              <Edit className="w-4 h-4" />{" "}
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {editMode ? (
        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl shadow-sm border border-inherit/30 transition-colors">
          <Signup
            isEditMode={true}
            initialData={signupInitialData || profile}
            onSave={handleUpdateProfile}
            onCancel={() => setEditMode(false)}
            isUpdating={updating}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {infoItems.map((item, idx) => (
            <InfoItem
              key={idx}
              icon={item.icon}
              label={item.label}
              value={item.value}
              colorClass={item.colorClass}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileSection;
