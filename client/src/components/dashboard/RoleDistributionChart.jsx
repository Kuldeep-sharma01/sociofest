import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444"];

const RoleDistributionChart = ({ stats }) => {
  const { appTheme } = useTheme();

  const data = [
    { name: "Students", value: stats?.students || 0 },
    { name: "Teachers", value: stats?.teachers || 0 },
    { name: "Admins", value: stats?.admins || 0 },
  ];

  return (
    <div className={`${getCardThemeClasses(appTheme)} p-6 rounded-2xl shadow-sm border transition-colors text-inherit [&_.recharts-text]:fill-current [&_.recharts-text]:opacity-80 [&_.recharts-legend-item-text]:!text-current`}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={100}
            fill="#8884d8"
            label
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RoleDistributionChart;
