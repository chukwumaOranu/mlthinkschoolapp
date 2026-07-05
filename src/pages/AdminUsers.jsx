import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { resolveApiAssetUrl } from "../api";
import Pagination, { usePagination } from "../components/Pagination";

const defaultUserForm = {
  username: "",
  email: "",
  password: "",
  role_id: "",
  assigned_school_id: "",
};

const defaultRoleForm = {
  name: "",
  description: "",
};

export default function AdminUsers({ user }) {
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState(defaultUserForm);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-bootstrap"],
    queryFn: async () => {
      const response = await api.get("/admin/bootstrap");
      return response.data;
    },
  });

  const users = data?.users || [];
  const roles = data?.roles || [];
  const permissions = data?.permissions || [];
  const schools = data?.schools || [];
  const userPagination = usePagination(users, [users]);

  useEffect(() => {
    if (roles.length) {
      setUserForm((current) => ({
        ...current,
        role_id: current.role_id || roles[0].id,
      }));
    }
  }, [roles]);

  const refreshAdminData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-bootstrap"] });
  };

  const showStatus = (message) => {
    setStatus(message);
    setError("");
  };

  const showError = (requestError, fallback) => {
    setError(requestError.response?.data?.detail || fallback);
    setStatus("");
  };

  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      await api.post("/admin/users", {
        username: payload.username.trim(),
        email: payload.email.trim(),
        password: payload.password,
        role_id: Number(payload.role_id),
        assigned_school_id: payload.assigned_school_id || null,
      });
    },
    onSuccess: async () => {
      setUserForm({ ...defaultUserForm, role_id: roles[0]?.id || "" });
      showStatus("User account created successfully.");
      await refreshAdminData();
    },
    onError: (requestError) => {
      showError(requestError, "Unable to create the user account.");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, changes }) => {
      await api.patch(`/admin/users/${userId}`, changes);
    },
    onSuccess: async (_, variables) => {
      const targetUser = users.find((entry) => entry.id === variables.userId);
      showStatus(`Updated ${targetUser?.username || "user"}.`);
      await refreshAdminData();
    },
    onError: (requestError, variables) => {
      const targetUser = users.find((entry) => entry.id === variables.userId);
      showError(requestError, `Unable to update ${targetUser?.username || "user"}.`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      await api.delete(`/admin/users/${userId}`);
    },
    onSuccess: async (_, userId) => {
      const targetUser = users.find((entry) => entry.id === userId);
      showStatus(`Deleted ${targetUser?.username || "user"}.`);
      setEditingUserId(null);
      await refreshAdminData();
    },
    onError: (requestError, userId) => {
      const targetUser = users.find((entry) => entry.id === userId);
      showError(requestError, `Unable to delete ${targetUser?.username || "user"}.`);
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (payload) => {
      await api.post("/admin/roles", payload);
    },
    onSuccess: async () => {
      setRoleForm(defaultRoleForm);
      showStatus("Role created successfully.");
      await refreshAdminData();
    },
    onError: (requestError) => {
      showError(requestError, "Unable to create the role.");
    },
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }) => {
      await api.patch(`/admin/roles/${roleId}/permissions`, { permission_ids: permissionIds });
    },
    onSuccess: async (_, variables) => {
      const role = roles.find((entry) => entry.id === variables.roleId);
      showStatus(`Permissions updated for ${role?.name || "role"}.`);
      await refreshAdminData();
    },
    onError: (requestError, variables) => {
      const role = roles.find((entry) => entry.id === variables.roleId);
      showError(requestError, `Unable to update permissions for ${role?.name || "role"}.`);
    },
  });

  const updateSchoolBrandingMutation = useMutation({
    mutationFn: async ({ schoolId, formData }) => {
      await api.post(`/admin/schools/${encodeURIComponent(schoolId)}/branding`, formData);
    },
    onSuccess: async (_, variables) => {
      const school = schools.find((entry) => entry.school_id === variables.schoolId);
      showStatus(`Branding updated for ${school?.display_name || school?.school_name || variables.schoolId}.`);
      await refreshAdminData();
      await queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (requestError, variables) => {
      const school = schools.find((entry) => entry.school_id === variables.schoolId);
      showError(requestError, `Unable to update branding for ${school?.school_name || variables.schoolId}.`);
    },
  });

  const handleCreateUser = async (event) => {
    event.preventDefault();
    createUserMutation.mutate(userForm);
  };

  const handleUpdateUser = async (targetUser, changes) => {
    updateUserMutation.mutate({ userId: targetUser.id, changes });
  };

  const startEditUser = (targetUser) => {
    setEditingUserId(targetUser.id);
    setEditUserForm({
      username: targetUser.username,
      email: targetUser.email,
      password: "",
      role_id: targetUser.role.id,
      assigned_school_id: targetUser.assigned_school_id || "",
      is_active: targetUser.is_active,
    });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditUserForm(defaultUserForm);
  };

  const handleSaveUser = (targetUser) => {
    const changes = {
      username: editUserForm.username,
      email: editUserForm.email,
      role_id: Number(editUserForm.role_id),
      assigned_school_id: editUserForm.assigned_school_id || null,
      is_active: Boolean(editUserForm.is_active),
    };
    if (editUserForm.password) {
      changes.password = editUserForm.password;
    }
    updateUserMutation.mutate(
      { userId: targetUser.id, changes },
      {
        onSuccess: () => {
          setEditingUserId(null);
          setEditUserForm(defaultUserForm);
        },
      }
    );
  };

  const handleDeleteUser = (targetUser) => {
    if (window.confirm(`Delete ${targetUser.username}? This cannot be undone.`)) {
      deleteUserMutation.mutate(targetUser.id);
    }
  };

  const handleCreateRole = async (event) => {
    event.preventDefault();
    createRoleMutation.mutate(roleForm);
  };

  const handlePermissionToggle = async (role, permissionId, checked) => {
    const nextIds = checked
      ? [...role.permissions.map((item) => item.id), permissionId]
      : role.permissions.filter((item) => item.id !== permissionId).map((item) => item.id);
    updateRolePermissionsMutation.mutate({ roleId: role.id, permissionIds: nextIds });
  };

  const handleBrandingSubmit = (event, school) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateSchoolBrandingMutation.mutate({ schoolId: school.school_id, formData });
  };

  return (
    <section className="admin-stack">
      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>Access Control Console</h3>
            <p>Manage real FastAPI users, security roles, and permission mappings from the dashboard.</p>
          </div>
          <span className="section-tag">Admin</span>
        </div>

        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <span>Signed-in admin</span>
            <strong>{user.username}</strong>
            <em>{user.role.name}</em>
          </div>
          <div className="admin-summary-card">
            <span>Registered users</span>
            <strong>{users.length}</strong>
            <em>Managed identities</em>
          </div>
          <div className="admin-summary-card">
            <span>Security roles</span>
            <strong>{roles.length}</strong>
            <em>Permission bundles</em>
          </div>
          <div className="admin-summary-card">
            <span>Available permissions</span>
            <strong>{permissions.length}</strong>
            <em>Policy controls</em>
          </div>
        </div>

        {status ? <div className="status-banner success">{status}</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}
      </div>

      <div className="admin-grid">
        <form className="surface-card admin-form-card" onSubmit={handleCreateUser}>
          <div className="section-heading compact">
            <div>
              <h3>Create User</h3>
              <p>Add a real account with username, email, password, and assigned role.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="new-username">Username</label>
              <input
                id="new-username"
                value={userForm.username}
                onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="new-email">Email</label>
              <input
                id="new-email"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="new-password">Password</label>
              <input
                id="new-password"
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="new-role">Role</label>
              <select
                id="new-role"
                value={userForm.role_id}
                onChange={(event) => setUserForm({ ...userForm, role_id: event.target.value })}
                required
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="new-school">School scope</label>
              <select
                id="new-school"
                value={userForm.assigned_school_id}
                onChange={(event) => setUserForm({ ...userForm, assigned_school_id: event.target.value })}
              >
                <option value="">All schools</option>
                {schools.map((school) => (
                  <option key={school.school_id} value={school.school_id}>
                    {school.school_short_name || school.school_name || school.school_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="primary-button" disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? "Creating User..." : "Create Secure User"}
          </button>
        </form>

        <form className="surface-card admin-form-card" onSubmit={handleCreateRole}>
          <div className="section-heading compact">
            <div>
              <h3>Create Role</h3>
              <p>Define a named access profile, then assign permissions to it below.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="role-name">Role name</label>
              <input
                id="role-name"
                value={roleForm.name}
                onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                required
              />
            </div>
            <div className="field-group field-span-full">
              <label htmlFor="role-description">Description</label>
              <textarea
                id="role-description"
                rows="4"
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="primary-button secondary-tone">
            Create Role
          </button>
        </form>
      </div>

      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>School Branding</h3>
            <p>Upload the school logo and display name shown on the dashboard for assigned school users.</p>
          </div>
          <span className="section-tag">Branding</span>
        </div>

        <div className="school-branding-grid">
          {schools.map((school) => (
            <form
              className="school-branding-card"
              key={school.school_id}
              onSubmit={(event) => handleBrandingSubmit(event, school)}
            >
              <div className="branding-logo-preview">
                {school.logo_url ? (
                  <img
                    src={resolveApiAssetUrl(school.logo_url)}
                    alt={`${school.display_name || school.school_name || school.school_id} logo`}
                  />
                ) : (
                  <span>{(school.school_short_name || school.school_name || school.school_id).slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="field-group">
                <label htmlFor={`branding-name-${school.school_id}`}>Dashboard school name</label>
                <input
                  id={`branding-name-${school.school_id}`}
                  name="display_name"
                  defaultValue={school.display_name || school.school_name || school.school_short_name || ""}
                  placeholder={school.school_name || school.school_id}
                />
              </div>
              <div className="field-group">
                <label htmlFor={`branding-logo-${school.school_id}`}>Logo image</label>
                <input id={`branding-logo-${school.school_id}`} name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
              </div>
              <button type="submit" className="primary-button secondary-tone" disabled={updateSchoolBrandingMutation.isPending}>
                Save Branding
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>User Directory</h3>
            <p>Change assigned roles and activate or deactivate accounts without leaving the dashboard.</p>
          </div>
          <span className="section-tag">Users</span>
        </div>

        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>School</span>
            <span>Status</span>
            <span>Permissions</span>
            <span>Actions</span>
          </div>
          {userPagination.paginatedItems.map((entry) => {
            const isEditing = editingUserId === entry.id;
            return (
              <div className="admin-table-row" key={entry.id}>
                <span>
                  {isEditing ? (
                    <input
                      value={editUserForm.username}
                      onChange={(event) => setEditUserForm({ ...editUserForm, username: event.target.value })}
                    />
                  ) : (
                    <strong>{entry.username}</strong>
                  )}
                </span>
                <span>
                  {isEditing ? (
                    <div className="user-edit-stack">
                      <input
                        type="email"
                        value={editUserForm.email}
                        onChange={(event) => setEditUserForm({ ...editUserForm, email: event.target.value })}
                      />
                      <input
                        type="password"
                        placeholder="New password optional"
                        value={editUserForm.password}
                        onChange={(event) => setEditUserForm({ ...editUserForm, password: event.target.value })}
                      />
                    </div>
                  ) : (
                    entry.email
                  )}
                </span>
                <span>
                  <select
                    value={isEditing ? editUserForm.role_id : entry.role.id}
                    onChange={(event) =>
                      isEditing
                        ? setEditUserForm({ ...editUserForm, role_id: event.target.value })
                        : handleUpdateUser(entry, { role_id: Number(event.target.value) })
                    }
                    disabled={updateUserMutation.isPending || deleteUserMutation.isPending}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span>
                  <select
                    value={isEditing ? editUserForm.assigned_school_id : entry.assigned_school_id || ""}
                    onChange={(event) =>
                      isEditing
                        ? setEditUserForm({ ...editUserForm, assigned_school_id: event.target.value })
                        : handleUpdateUser(entry, { assigned_school_id: event.target.value || null })
                    }
                    disabled={updateUserMutation.isPending || deleteUserMutation.isPending}
                  >
                    <option value="">All schools</option>
                    {schools.map((school) => (
                      <option key={school.school_id} value={school.school_id}>
                        {school.school_short_name || school.school_name || school.school_id}
                      </option>
                    ))}
                  </select>
                </span>
                <span>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={isEditing ? Boolean(editUserForm.is_active) : entry.is_active}
                      onChange={(event) =>
                        isEditing
                          ? setEditUserForm({ ...editUserForm, is_active: event.target.checked })
                          : handleUpdateUser(entry, { is_active: event.target.checked })
                      }
                      disabled={updateUserMutation.isPending || deleteUserMutation.isPending}
                    />
                    <span>{(isEditing ? editUserForm.is_active : entry.is_active) ? "Active" : "Inactive"}</span>
                  </label>
                </span>
                <span className="permission-list-inline">{entry.permissions.join(", ")}</span>
                <span>
                  <div className="table-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="ghost-button mini"
                          onClick={() => handleSaveUser(entry)}
                          disabled={updateUserMutation.isPending}
                        >
                          Save
                        </button>
                        <button type="button" className="ghost-button mini" onClick={cancelEditUser}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="ghost-button mini" onClick={() => startEditUser(entry)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ghost-button mini danger"
                          onClick={() => handleDeleteUser(entry)}
                          disabled={deleteUserMutation.isPending || entry.id === user.id}
                          title={entry.id === user.id ? "You cannot delete your own account" : "Delete user"}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </span>
              </div>
            );
          })}
        </div>
        <Pagination {...userPagination} onPageChange={userPagination.setPage} />
      </div>

      <div className="surface-card">
        <div className="section-heading">
          <div>
            <h3>Role Permission Matrix</h3>
            <p>Control exactly which dashboard capabilities each role can access.</p>
          </div>
          <span className="section-tag">Roles</span>
        </div>

        <div className="role-grid">
          {roles.map((role) => (
            <article className="role-card" key={role.id}>
              <div className="role-card-header">
                <div>
                  <h4>{role.name}</h4>
                  <p>{role.description || "No description provided yet."}</p>
                </div>
                <span className="table-chip">{role.permissions.length} permissions</span>
              </div>

              <div className="role-permission-list">
                {permissions.map((permission) => {
                  const checked = role.permissions.some((item) => item.id === permission.id);
                  return (
                    <label className="permission-toggle" key={permission.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          handlePermissionToggle(role, permission.id, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{permission.name}</strong>
                        <em>{permission.code}</em>
                      </span>
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
