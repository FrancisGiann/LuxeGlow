<section class="admin-page admin-page--gallery">
  <div class="page-header">
    <div>
      <h1 class="page-title">Services Gallery</h1>
      <p class="page-subtitle">Manage the treatments shown on the customer site</p>
    </div>
    <button class="btn btn--brand" id="addServiceBtn">+ Add Service</button>
  </div>
  <div class="gallery-grid" id="galleryGrid"><!-- injected --></div>
</section>

<!-- Native Dialog Modal for Add/Edit -->
<dialog id="serviceModal" style="padding: 2rem; border-radius: 8px; border: 1px solid #ddd; max-width: 400px; width: 100%;">
  <h2 id="serviceModalTitle" style="margin-bottom: 1rem;">Edit Service</h2>
  <div style="display: flex; flex-direction: column; gap: 1rem;">
    <input type="hidden" id="srvId" />
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
      Name
      <input type="text" id="srvName" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
    </label>
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
      Category
      <input type="text" id="srvCategory" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
    </label>
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
      Description
      <textarea id="srvDesc" rows="3" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-family: inherit;"></textarea>
    </label>
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
      Cover Image
      <div id="srvImagePreview" style="width: 100%; height: 120px; background-size: cover; background-position: center; border-radius: 4px; display: none; margin-bottom: 0.5rem;"></div>
      <label class="btn btn--soft" style="cursor: pointer; display: block; text-align: center; border: 1px dashed #ccc;">
        <span id="srvImageLabelText">📸 Select a Photo</span>
        <input type="file" id="srvImage" accept="image/*" style="display: none;" />
      </label>
    <input type="hidden" id="srvRemoveImageFlag" value="0" />
    <button type="button" id="srvRemoveImageBtn" class="btn btn--soft" style="display: none; width: 100%; color: #d93025; border-color: #fad2cf; background: #fce8e6; transition: background 0.2s;">
      🗑️ Remove Image
    </button>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
        Price (₱)
        <input type="number" id="srvPrice" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
      </label>
      <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; font-weight: 600;">
        Duration (Mins)
        <input type="number" id="srvDuration" style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
      </label>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
      <button class="btn btn--soft" id="serviceModalCancel">Cancel</button>
      <button class="btn btn--brand" id="serviceModalSave">Save</button>
    </div>
  </div>
</dialog>