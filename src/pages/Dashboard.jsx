import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { resolveApiAssetUrl } from "../api";
import Overview from "./Overview";
import StudentSuccess from "./StudentSuccess";
import Students from "./Students";
import Performance from "./Performance";
import Subjects from "./Subjects";
import Attendance from "./Attendance";
import Teachers from "./Teachers";
import Predictions from "./Predictions";
import Fees from "./Fees";
import Interventions from "./Interventions";
import Reports from "./Reports";
import UKImport from "./UKImport";
import NigeriaImport from "./NigeriaImport";
import AdminUsers from "./AdminUsers";

const tabs = [
  { key: "overview",    label: "Overview",         permission: "view_dashboard" },
  { key: "success",     label: "Student Success",  permission: "view_dashboard" },
  { key: "interventions", label: "Interventions",  permission: "view_dashboard" },
  { key: "reports",     label: "Reports",          permission: "view_dashboard" },
  { key: "uk_import",   label: "UK Import",        permission: "manage_users" },
  { key: "nigeria_import", label: "Nigeria Import", permission: "manage_users" },
  { key: "students",    label: "Students",          permission: "view_dashboard" },
  { key: "performance", label: "Performance",       permission: "view_dashboard" },
  { key: "subjects",    label: "Subject Analysis",  permission: "view_subjects" },
  { key: "attendance",  label: "Attendance",        permission: "view_dashboard" },
  { key: "teachers",    label: "Teachers",          permission: "view_dashboard" },
  { key: "predictions", label: "Predictions",       permission: "view_predictions" },
  { key: "fees",        label: "School Fees",       permission: "view_fees" },
  { key: "admin",       label: "Access Control",    permission: "manage_users" },
];

const navSections = [
  {
    key: "command",
    label: "Command Center",
    description: "Summary, support, and reports",
    tabs: ["overview", "success", "interventions", "reports"],
  },
  {
    key: "academics",
    label: "Academics",
    description: "Learners, subjects, attendance, teachers",
    tabs: ["students", "performance", "subjects", "attendance", "teachers"],
  },
  {
    key: "insights",
    label: "Insights & Finance",
    description: "Predictions and school fees",
    tabs: ["predictions", "fees"],
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "School data imports",
    tabs: ["uk_import", "nigeria_import"],
  },
  {
    key: "administration",
    label: "Administration",
    description: "Users, roles, and branding",
    tabs: ["admin"],
  },
];

export default function Dashboard({ user, onLogout }) {
  const allowedTabs = tabs.filter((tab) => user.permissions.includes(tab.permission));
  const tabsByKey = Object.fromEntries(allowedTabs.map((tab) => [tab.key, tab]));
  const allowedSections = navSections
    .map((section) => ({
      ...section,
      items: section.tabs.map((tabKey) => tabsByKey[tabKey]).filter(Boolean),
    }))
    .filter((section) => section.items.length > 0);
  const hasPermission = (permission) => user.permissions.includes(permission);
  const [activeTab, setActiveTab] = useState(allowedTabs[0]?.key || "overview");
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(allowedSections.map((section, index) => [section.key, index === 0]))
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState(user.assigned_school_id || "");

  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: () => api.get("/overview/schools").then((r) => r.data),
  });

  const renderTab = () => {
    switch (activeTab) {
      case "overview":    return <Overview schoolId={selectedSchoolId} />;
      case "success":     return <StudentSuccess schoolId={selectedSchoolId} />;
      case "interventions": return <Interventions schoolId={selectedSchoolId} />;
      case "reports":     return <Reports schoolId={selectedSchoolId} />;
      case "uk_import":   return <UKImport />;
      case "nigeria_import": return <NigeriaImport />;
      case "students":    return <Students schoolId={selectedSchoolId} />;
      case "performance": return <Performance schoolId={selectedSchoolId} />;
      case "subjects":    return <Subjects schoolId={selectedSchoolId} />;
      case "attendance":  return <Attendance schoolId={selectedSchoolId} />;
      case "teachers":    return <Teachers schoolId={selectedSchoolId} />;
      case "predictions": return <Predictions schoolId={selectedSchoolId} />;
      case "fees":        return <Fees schoolId={selectedSchoolId} />;
      case "admin":       return <AdminUsers user={user} />;
      default:            return <Overview schoolId={selectedSchoolId} />;
    }
  };

  const selectedSchool = schools.find((school) => school.school_id === selectedSchoolId);
  const isSchoolScoped = Boolean(user.assigned_school_id) && !hasPermission("manage_users") && !hasPermission("manage_roles");
  const dashboardSchoolName =
    selectedSchool?.display_name || selectedSchool?.school_name || selectedSchool?.school_short_name || "DeepAcademia";
  const dashboardSchoolLogo = selectedSchool?.logo_url ? resolveApiAssetUrl(selectedSchool.logo_url) : "";
  const setActiveSidebarTab = (tabKey, sectionKey) => {
    setActiveTab(tabKey);
    setOpenSections((current) => ({ ...current, [sectionKey]: true }));
  };
  const toggleSidebarSection = (sectionKey) => {
    setOpenSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-grid">
        <aside className="dashboard-sidebar">
          <div className="brand-block">
            {dashboardSchoolLogo ? (
              <img className="brand-logo" src={dashboardSchoolLogo} alt={`${dashboardSchoolName} logo`} />
            ) : (
              <span className="brand-mark">DA</span>
            )}
            <h1>{dashboardSchoolName}</h1>
            <p>Academic intelligence dashboard powered by DeepAcademia.</p>
          </div>

          <nav className="sidebar-tabs" aria-label="Dashboard sections">
            {allowedSections.map((section) => {
              const isOpen = Boolean(openSections[section.key]);
              const hasActiveTab = section.items.some((tab) => tab.key === activeTab);
              return (
                <div className={`sidebar-section ${hasActiveTab ? "active-section" : ""}`} key={section.key}>
                  <button
                    type="button"
                    className="sidebar-section-toggle"
                    onClick={() => toggleSidebarSection(section.key)}
                    aria-expanded={isOpen}
                  >
                    <span>
                      <strong>{section.label}</strong>
                      <em>{section.description}</em>
                    </span>
                    <small>{section.items.length}</small>
                    <span className={`section-chevron ${isOpen ? "open" : ""}`}>v</span>
                  </button>

                  {isOpen ? (
                    <div className="sidebar-section-items">
                      {section.items.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={`sidebar-tab ${activeTab === tab.key ? "active" : ""}`}
                          onClick={() => setActiveSidebarTab(tab.key, section.key)}
                        >
                          <span className="tab-copy">
                            <strong>{tab.label}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-note">
            <strong>Pipeline status</strong>
            <p>Bronze, silver, gold, and dashboard snapshots now run locally/MySQL, with Databricks kept only as a reference path.</p>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">{user.email.slice(0, 2).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user.username}</strong>
              <p>
                {user.email}
                <br />
                {user.role.name}
              </p>
            </div>
            <button type="button" className="ghost-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <section className="hero-panel">
            <span className="hero-topline">School Analytics Control Center</span>
            <div className="hero-layout">
              <div className="hero-copy">
                <h2>Dashboard</h2>
                <p>Track attendance, subject performance, teacher effectiveness, fees, and ML-powered student risk signals in one place.</p>
              </div>

              <div className="hero-metrics">
                <div className="metric-card metric-control">
                  <span>School view</span>
                  <select
                    className="hero-select"
                    value={selectedSchoolId}
                    onChange={(event) => setSelectedSchoolId(event.target.value)}
                    disabled={isSchoolScoped}
                  >
                    {!isSchoolScoped ? <option value="">All Schools</option> : null}
                    {schools.map((school) => (
                      <option key={school.school_id} value={school.school_id}>
                        {school.school_short_name || school.school_name}
                      </option>
                    ))}
                  </select>
                  <em>{selectedSchool ? dashboardSchoolName : "Combined dashboard"}</em>
                </div>
                <div className="metric-card">
                  <span>Data layers</span>
                  <strong>3</strong>
                  <em>Bronze, silver, gold</em>
                </div>
                <div className="metric-card">
                  <span>ML signals</span>
                  <strong>3</strong>
                  <em>Dropout, high performer & improving</em>
                </div>
                <div className="metric-card">
                  <span>Primary views</span>
                  <strong>{allowedTabs.length}</strong>
                  <em>Enabled by permissions</em>
                </div>
              </div>
            </div>
          </section>

          {renderTab()}
          <footer className="dashboard-footer">Powered By DeepAcademia</footer>
        </main>
      </div>
    </div>
  );
}
