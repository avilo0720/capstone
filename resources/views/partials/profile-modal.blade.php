@if($user)
<div class="profile-modal-overlay --hidden" id="profileModalOverlay">
  <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
    <div class="profile-modal__header">
      <div>
        <h2 id="profileModalTitle">My Profile</h2>
        <p class="profile-modal__subtitle" id="profileModalSubtitle">Your account details</p>
      </div>
      <button type="button" class="profile-modal__close" id="profileModalClose" aria-label="Close">&times;</button>
    </div>

    <div class="profile-modal__error --hidden" id="profileFormError"></div>

    <div class="profile-view" id="profileView">
      <div class="profile-view__hero">
        <span class="profile-view__avatar" id="profileViewAvatar" data-initials="?">?</span>
        <div class="profile-view__identity">
          <strong id="profileViewName">—</strong>
          <span class="profile-view__badge" id="profileViewRole">—</span>
        </div>
      </div>

      <dl class="profile-view__details">
        <div>
          <dt>Username</dt>
          <dd id="profileViewUsername">—</dd>
        </div>
        <div>
          <dt>Birthday</dt>
          <dd id="profileViewBirthday">—</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd id="profileViewRoleDetail">—</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd id="profileViewDepartment">—</dd>
        </div>
      </dl>

      <div class="profile-modal__footer profile-modal__footer--stack">
        <button type="button" class="profile-btn profile-btn--primary" id="profileEditBtn">Edit profile</button>
        <button type="button" class="profile-btn profile-btn--danger" id="profileLogoutBtn">Logout</button>
      </div>
    </div>

    <form id="profileForm" class="profile-modal__body profile-edit --hidden" enctype="multipart/form-data">
      <section class="profile-section">
        <h3 class="profile-section__title">Profile picture</h3>
        <div class="profile-picture-editor">
          <span class="profile-picture-editor__preview" id="profilePicturePreview" data-initials="?">?</span>
          <div class="profile-picture-editor__actions">
            <label class="profile-btn profile-btn--ghost profile-picture-editor__upload">
              Upload photo
              <input type="file" id="profilePictureInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" hidden />
            </label>
            <button type="button" class="profile-btn profile-btn--ghost" id="profilePictureRemoveBtn">Remove</button>
            <p class="profile-meta__hint">JPG, PNG, WEBP or GIF. You’ll crop it before saving.</p>
          </div>
        </div>
      </section>

      <section class="profile-section">
        <h3 class="profile-section__title">Personal info</h3>
        <div class="profile-form-grid">
          <label>
            <span>First name</span>
            <input type="text" id="profileFirstName" required />
          </label>
          <label>
            <span>Last name</span>
            <input type="text" id="profileLastName" required />
          </label>
          <label>
            <span>Username</span>
            <input type="text" id="profileUsername" required autocomplete="username" />
          </label>
          <label>
            <span>Birthday</span>
            <input type="date" id="profileBirthday" />
          </label>
        </div>
      </section>

      <section class="profile-section">
        <h3 class="profile-section__title">Assigned role</h3>
        <div class="profile-meta">
          <div>
            <span class="profile-meta__label">Role</span>
            <strong id="profileRoleDisplay">—</strong>
          </div>
          <div>
            <span class="profile-meta__label">Department</span>
            <strong id="profileDepartmentDisplay">—</strong>
          </div>
        </div>
        <p class="profile-meta__hint">Role and department are managed by an administrator.</p>
      </section>

      <section class="profile-section">
        <h3 class="profile-section__title">Change password</h3>
        <div class="profile-form-grid">
          <label class="profile-form-grid__full">
            <span>Current password</span>
            <input type="password" id="profileCurrentPassword" autocomplete="current-password" />
          </label>
          <label>
            <span>New password</span>
            <input type="password" id="profileNewPassword" autocomplete="new-password" />
          </label>
          <label>
            <span>Confirm new password</span>
            <input type="password" id="profileConfirmPassword" autocomplete="new-password" />
          </label>
        </div>
        <p class="profile-meta__hint">Leave password fields blank to keep your current password.</p>
      </section>

      <div class="profile-modal__footer">
        <button type="button" class="profile-btn profile-btn--ghost" id="profileBackBtn">Back</button>
        <button type="submit" class="profile-btn profile-btn--primary" id="profileSaveBtn">Save changes</button>
      </div>
    </form>
  </div>
</div>
@endif
