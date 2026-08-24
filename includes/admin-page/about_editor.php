<section class="admin-page admin-page--about">
  <div class="page-header">
    <div>
      <h1 class="page-title">About Page Editor</h1>
      <p class="page-subtitle">Update the business information shown to customers</p>
    </div>
  </div>
  <div class="card about-editor">
    <label class="field">
      <span class="field__label">Salon Name</span>
      <input type="text" id="aboutName" placeholder="Loading salon name..." />
    </label>
    <label class="field">
      <span class="field__label">About Description</span>
      <textarea id="aboutDesc" rows="5" placeholder="Loading description..."></textarea>
    </label>
    <label class="field">
      <span class="field__label">Mission Statement</span>
      <textarea id="aboutMission" rows="4" placeholder="Loading mission statement..."></textarea>
    </label>

    <h2 class="section-subtitle" style="margin-top: 1.5rem;">Contact &amp; Business Information</h2>

    <label class="field">
      <span class="field__label">Contact Number</span>
      <input type="text" id="aboutPhone" placeholder="e.g. 0917 000 1122" />
    </label>
    <label class="field">
      <span class="field__label">Email Address</span>
      <input type="email" id="aboutEmail" placeholder="e.g. hello@astridnails.ph" />
    </label>
    <label class="field">
      <span class="field__label">Salon Address</span>
      <input type="text" id="aboutAddress" placeholder="e.g. 12 Mabini St, Quezon City" />
    </label>
    <label class="field">
      <span class="field__label">Business Hours (one schedule per line)</span>
      <textarea id="aboutHours" rows="3" placeholder="Monday – Saturday: 10:00 AM – 8:00 PM&#10;Sunday: 11:00 AM – 6:00 PM"></textarea>
    </label>
    <label class="field">
      <span class="field__label">Salon Policies (one policy per line)</span>
      <textarea id="aboutPolicies" rows="5" placeholder="One policy per line — shown in the Salon Policies section of the website"></textarea>
    </label>

    <button class="btn btn--brand" id="saveAboutBtn">Save Changes</button>
  </div>
</section>
