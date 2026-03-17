import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";

actor {
  include MixinStorage();

  // Types

  type FileId = Nat;
  type FolderId = Nat;
  type TagId = Nat;

  type Tag = {
    id : TagId;
    name : Text;
    color : Text;
  };

  type FileMetadata = {
    id : FileId;
    name : Text;
    description : Text;
    tagIds : [TagId];
    folderId : ?FolderId;
    size : Nat64;
    uploadDate : Int;
    modifiedDate : Int;
    fileType : Text;
    blob : Storage.ExternalBlob;
  };

  type Folder = {
    id : FolderId;
    name : Text;
    parentId : ?FolderId;
    createdDate : Int;
    modifiedDate : Int;
  };

  type FolderContents = {
    folders : [Folder];
    files : [FileMetadata];
  };

  type Profile = {
    name : Text;
  };

  // State - Per-user data storage

  var userProfiles : Map.Map<Principal, Profile> = Map.empty();
  var userFiles : Map.Map<Principal, Map.Map<FileId, FileMetadata>> = Map.empty();
  var userFolders : Map.Map<Principal, Map.Map<FolderId, Folder>> = Map.empty();
  var userTags : Map.Map<Principal, Map.Map<TagId, Tag>> = Map.empty();
  var userNextFileId : Map.Map<Principal, Nat> = Map.empty();
  var userNextFolderId : Map.Map<Principal, Nat> = Map.empty();
  var userNextTagId : Map.Map<Principal, Nat> = Map.empty();

  // Helpers

  func requireAuth(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Not authenticated");
    };
  };

  func getUserFiles(user : Principal) : Map.Map<FileId, FileMetadata> {
    switch (userFiles.get(user)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<FileId, FileMetadata>();
        userFiles.add(user, m);
        m;
      };
    };
  };

  func getUserFolders(user : Principal) : Map.Map<FolderId, Folder> {
    switch (userFolders.get(user)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<FolderId, Folder>();
        userFolders.add(user, m);
        m;
      };
    };
  };

  func getUserTags(user : Principal) : Map.Map<TagId, Tag> {
    switch (userTags.get(user)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<TagId, Tag>();
        userTags.add(user, m);
        m;
      };
    };
  };

  func genFileId(user : Principal) : Nat {
    let id = switch (userNextFileId.get(user)) {
      case (?id) { id };
      case (null) { 1 };
    };
    userNextFileId.add(user, id + 1);
    id;
  };

  func genFolderId(user : Principal) : Nat {
    let id = switch (userNextFolderId.get(user)) {
      case (?id) { id };
      case (null) { 1 };
    };
    userNextFolderId.add(user, id + 1);
    id;
  };

  func genTagId(user : Principal) : Nat {
    let id = switch (userNextTagId.get(user)) {
      case (?id) { id };
      case (null) { 1 };
    };
    userNextTagId.add(user, id + 1);
    id;
  };

  func textContainsIgnoreCase(haystack : Text, needle : Text) : Bool {
    haystack.toLower().contains(#text(needle.toLower()));
  };

  func namesEqual(a : Text, b : Text) : Bool {
    a.toLower() == b.toLower();
  };

  // Build text from a range of characters
  func textFromRange(chars : [Char], start : Nat, endExclusive : Nat) : Text {
    var result = "";
    var i = start;
    while (i < endExclusive and i < chars.size()) {
      result #= Text.fromChar(chars[i]);
      i += 1;
    };
    result;
  };

  // Find opening parenthesis by scanning backwards
  func findOpenParen(chars : [Char], pos : Nat) : ?Nat {
    if (pos == 0) { return null };
    if (chars[pos] == '(') { return ?pos };
    findOpenParen(chars, pos - 1);
  };

  // Parse "name (2)" → ("name", 2) or "name" → ("name", 0)
  func parseNameSuffix(name : Text) : (Text, Nat) {
    let chars = name.chars().toArray();
    let len = chars.size();

    // Need at least "x (1)" = 5 chars, and must end with ')'
    if (len < 5 or chars[len - 1] != ')') {
      return (name, 0);
    };

    // Find matching '(' by scanning backwards
    let parenStart = findOpenParen(chars, len - 2);

    switch (parenStart) {
      case (null) { (name, 0) };
      case (?pStart) {
        // Must have a space before '('
        if (pStart == 0 or chars[pStart - 1] != ' ') {
          return (name, 0);
        };

        // Extract the number between '(' and ')'
        let numStart = pStart + 1;
        let numEnd = len - 1;
        if (numStart >= numEnd) {
          return (name, 0);
        };

        // Parse as number - all chars must be digits
        var num : Nat = 0;
        var j = numStart;
        while (j < numEnd) {
          let c = chars[j];
          if (c < '0' or c > '9') {
            return (name, 0);
          };
          num := num * 10 + ((c.toNat32() - 48).toNat());
          j += 1;
        };

        // Extract base name (everything before " (N)")
        let baseName = textFromRange(chars, 0, pStart - 1);
        (baseName, num);
      };
    };
  };

  // For files, handle extension: "photo (1).jpg" → ("photo", "jpg", 1)
  func parseFileNameSuffix(name : Text) : (Text, Text, Nat) {
    let chars = name.chars().toArray();
    let len = chars.size();

    // Find the last dot for extension
    var lastDot : ?Nat = null;
    var i : Nat = 0;
    while (i < len) {
      if (chars[i] == '.') {
        lastDot := ?i;
      };
      i += 1;
    };

    switch (lastDot) {
      case (null) {
        // No extension
        let (baseName, suffix) = parseNameSuffix(name);
        (baseName, "", suffix);
      };
      case (?dotPos) {
        if (dotPos == 0) {
          // Dot at start means no real extension (e.g., ".gitignore")
          let (baseName, suffix) = parseNameSuffix(name);
          return (baseName, "", suffix);
        };
        let baseWithSuffix = textFromRange(chars, 0, dotPos);
        let ext = textFromRange(chars, dotPos + 1, len);
        let (baseName, suffix) = parseNameSuffix(baseWithSuffix);
        (baseName, ext, suffix);
      };
    };
  };

  // Find unique folder name in parent (case-insensitive)
  func getUniqueFolderName(user : Principal, parentId : ?FolderId, desiredName : Text, excludeId : ?FolderId) : Text {
    let folders = getUserFolders(user);

    // Collect existing names in the target folder (case-insensitive)
    let existingNames = Map.empty<Text, ()>();
    for (folder in folders.values()) {
      // Skip the folder being renamed/moved
      let shouldExclude = switch (excludeId) {
        case (null) { false };
        case (?eid) { folder.id == eid };
      };
      if (not shouldExclude and folder.parentId == parentId) {
        existingNames.add(folder.name.toLower(), ());
      };
    };

    // If desired name doesn't conflict, use it
    if (not existingNames.containsKey(desiredName.toLower())) {
      return desiredName;
    };

    // Find highest existing suffix for this base name
    let (baseName, _) = parseNameSuffix(desiredName);
    var maxSuffix : Nat = 0;

    for (folder in folders.values()) {
      let shouldExclude = switch (excludeId) {
        case (null) { false };
        case (?eid) { folder.id == eid };
      };
      if (not shouldExclude and folder.parentId == parentId) {
        let (existingBase, existingSuffix) = parseNameSuffix(folder.name);
        if (namesEqual(existingBase, baseName) and existingSuffix >= maxSuffix) {
          maxSuffix := existingSuffix + 1;
        };
        // Also check if the existing name matches the base exactly (suffix 0)
        if (namesEqual(folder.name, baseName) and maxSuffix == 0) {
          maxSuffix := 1;
        };
      };
    };

    baseName # " (" # maxSuffix.toText() # ")";
  };

  // Find unique file name in folder (case-insensitive)
  func getUniqueFileName(user : Principal, folderId : ?FolderId, desiredName : Text, excludeId : ?FileId) : Text {
    let files = getUserFiles(user);

    // Collect existing names in the target folder (case-insensitive)
    let existingNames = Map.empty<Text, ()>();
    for (file in files.values()) {
      let shouldExclude = switch (excludeId) {
        case (null) { false };
        case (?eid) { file.id == eid };
      };
      if (not shouldExclude and file.folderId == folderId) {
        existingNames.add(file.name.toLower(), ());
      };
    };

    // If desired name doesn't conflict, use it
    if (not existingNames.containsKey(desiredName.toLower())) {
      return desiredName;
    };

    // Find highest existing suffix for this base name
    let (baseName, ext, _) = parseFileNameSuffix(desiredName);
    var maxSuffix : Nat = 0;

    for (file in files.values()) {
      let shouldExclude = switch (excludeId) {
        case (null) { false };
        case (?eid) { file.id == eid };
      };
      if (not shouldExclude and file.folderId == folderId) {
        let (existingBase, existingExt, existingSuffix) = parseFileNameSuffix(file.name);
        if (namesEqual(existingBase, baseName) and namesEqual(existingExt, ext) and existingSuffix >= maxSuffix) {
          maxSuffix := existingSuffix + 1;
        };
        // Also check if the existing name matches the base exactly (suffix 0)
        let fullBase = if (ext == "") { baseName } else { baseName # "." # ext };
        if (namesEqual(file.name, fullBase) and maxSuffix == 0) {
          maxSuffix := 1;
        };
      };
    };

    if (ext == "") {
      baseName # " (" # maxSuffix.toText() # ")";
    } else {
      baseName # " (" # maxSuffix.toText() # ")." # ext;
    };
  };

  func folderExists(user : Principal, folderId : FolderId) : Bool {
    getUserFolders(user).containsKey(folderId);
  };

  func assertFolderExists(user : Principal, folderId : ?FolderId) {
    switch (folderId) {
      case (null) {};
      case (?id) {
        if (not folderExists(user, id)) {
          Runtime.trap("Folder not found: " # id.toText());
        };
      };
    };
  };

  func assertTagsExist(user : Principal, tagIds : [TagId]) {
    let userTagMap = getUserTags(user);
    for (tagId in tagIds.vals()) {
      if (not userTagMap.containsKey(tagId)) {
        Runtime.trap("Tag not found: " # tagId.toText());
      };
    };
  };

  let maxFolderDepth : Nat = 100;

  func checkAncestor(folders : Map.Map<FolderId, Folder>, ancestorId : FolderId, currentId : ?FolderId, depth : Nat) : Bool {
    if (depth >= maxFolderDepth) {
      Runtime.trap("Folder hierarchy too deep or circular reference detected");
    };
    switch (currentId) {
      case (null) { false };
      case (?id) {
        if (id == ancestorId) { true } else {
          switch (folders.get(id)) {
            case (null) { false };
            case (?folder) {
              checkAncestor(folders, ancestorId, folder.parentId, depth + 1);
            };
          };
        };
      };
    };
  };

  func isAncestor(user : Principal, ancestorId : FolderId, descendantId : FolderId) : Bool {
    let folders = getUserFolders(user);
    checkAncestor(folders, ancestorId, ?descendantId, 0);
  };

  // Profile Management

  public query ({ caller }) func getProfile() : async ?Profile {
    requireAuth(caller);
    userProfiles.get(caller);
  };

  public shared ({ caller }) func setProfile(name : Text) : async () {
    requireAuth(caller);

    if (name == "") {
      Runtime.trap("Profile name cannot be empty");
    };

    userProfiles.add(caller, { name });
  };

  // Folder Operations

  public shared ({ caller }) func createFolder(name : Text, parentId : ?FolderId) : async Folder {
    requireAuth(caller);
    assertFolderExists(caller, parentId);

    if (name == "") {
      Runtime.trap("Folder name cannot be empty");
    };

    let uniqueName = getUniqueFolderName(caller, parentId, name, null);
    let folders = getUserFolders(caller);
    let folderId = genFolderId(caller);
    let now = Time.now();
    let folder : Folder = {
      id = folderId;
      name = uniqueName;
      parentId;
      createdDate = now;
      modifiedDate = now;
    };
    folders.add(folderId, folder);
    folder;
  };

  public shared ({ caller }) func renameFolder(id : FolderId, newName : Text) : async Folder {
    requireAuth(caller);

    if (newName == "") {
      Runtime.trap("Folder name cannot be empty");
    };

    let folders = getUserFolders(caller);
    switch (folders.get(id)) {
      case (null) { Runtime.trap("Folder not found") };
      case (?folder) {
        let uniqueName = getUniqueFolderName(caller, folder.parentId, newName, ?id);
        let updated : Folder = {
          id = folder.id;
          name = uniqueName;
          parentId = folder.parentId;
          createdDate = folder.createdDate;
          modifiedDate = Time.now();
        };
        folders.remove(id);
        folders.add(id, updated);
        updated;
      };
    };
  };

  public shared ({ caller }) func moveFolder(id : FolderId, newParentId : ?FolderId) : async Folder {
    requireAuth(caller);
    assertFolderExists(caller, newParentId);

    switch (newParentId) {
      case (null) {};
      case (?parentId) {
        if (id == parentId) {
          Runtime.trap("Cannot move folder into itself");
        };
        if (isAncestor(caller, id, parentId)) {
          Runtime.trap("Cannot move folder into its own descendant");
        };
      };
    };

    let folders = getUserFolders(caller);
    switch (folders.get(id)) {
      case (null) { Runtime.trap("Folder not found") };
      case (?folder) {
        let uniqueName = getUniqueFolderName(caller, newParentId, folder.name, ?id);
        let updated : Folder = {
          id = folder.id;
          name = uniqueName;
          parentId = newParentId;
          createdDate = folder.createdDate;
          modifiedDate = Time.now();
        };
        folders.remove(id);
        folders.add(id, updated);
        updated;
      };
    };
  };

  public shared ({ caller }) func deleteFolder(id : FolderId) : async () {
    requireAuth(caller);

    let folders = getUserFolders(caller);
    let files = getUserFiles(caller);

    if (not folders.containsKey(id)) {
      Runtime.trap("Folder not found");
    };

    // Collect all descendant folder IDs (including the target folder)
    let folderIdsToDelete = Map.empty<FolderId, ()>();
    folderIdsToDelete.add(id, ());

    // Keep finding children until no new folders are added
    var foundNew = true;
    while (foundNew) {
      foundNew := false;
      for (folder in folders.values()) {
        switch (folder.parentId) {
          case (?parentId) {
            if (folderIdsToDelete.containsKey(parentId) and not folderIdsToDelete.containsKey(folder.id)) {
              folderIdsToDelete.add(folder.id, ());
              foundNew := true;
            };
          };
          case (null) {};
        };
      };
    };

    // Delete all files in the folders to be deleted
    let fileIdsToDelete = files.values().filter(
      func(f) {
        switch (f.folderId) {
          case (?fid) { folderIdsToDelete.containsKey(fid) };
          case (null) { false };
        };
      }
    ).map(func(f) { f.id }).toArray();

    for (fileId in fileIdsToDelete.values()) {
      files.remove(fileId);
    };

    // Delete all folders
    for (folderId in folderIdsToDelete.keys()) {
      folders.remove(folderId);
    };
  };

  public query ({ caller }) func getAllFolders() : async [Folder] {
    requireAuth(caller);
    getUserFolders(caller).values().toArray();
  };

  public query ({ caller }) func getFolderContents(folderId : ?FolderId) : async FolderContents {
    requireAuth(caller);

    let folders = getUserFolders(caller);
    let files = getUserFiles(caller);

    let subfolders = folders.values().filter(func(f) { f.parentId == folderId }).toArray();
    let folderFiles = files.values().filter(func(f) { f.folderId == folderId }).toArray();

    { folders = subfolders; files = folderFiles };
  };

  func buildFolderPath(folders : Map.Map<FolderId, Folder>, pathMap : Map.Map<Nat, Folder>, currentId : ?FolderId, index : Nat) {
    if (index >= maxFolderDepth) {
      Runtime.trap("Folder hierarchy too deep or circular reference detected");
    };
    switch (currentId) {
      case (null) {};
      case (?id) {
        switch (folders.get(id)) {
          case (null) {};
          case (?folder) {
            pathMap.add(index, folder);
            buildFolderPath(folders, pathMap, folder.parentId, index + 1);
          };
        };
      };
    };
  };

  public query ({ caller }) func getFolderPath(folderId : FolderId) : async [Folder] {
    requireAuth(caller);

    let folders = getUserFolders(caller);
    let pathMap = Map.empty<Nat, Folder>();
    buildFolderPath(folders, pathMap, ?folderId, 0);
    pathMap.values().toArray();
  };

  // File Operations

  public shared ({ caller }) func uploadFile(
    name : Text,
    description : Text,
    tagIds : [TagId],
    folderId : ?FolderId,
    size : Nat64,
    fileType : Text,
    blob : Storage.ExternalBlob,
  ) : async FileMetadata {
    requireAuth(caller);
    assertFolderExists(caller, folderId);
    assertTagsExist(caller, tagIds);

    if (name == "") {
      Runtime.trap("File name cannot be empty");
    };

    let uniqueName = getUniqueFileName(caller, folderId, name, null);
    let files = getUserFiles(caller);
    let fileId = genFileId(caller);
    let now = Time.now();
    let metadata : FileMetadata = {
      id = fileId;
      name = uniqueName;
      description;
      tagIds;
      folderId;
      size;
      uploadDate = now;
      modifiedDate = now;
      fileType;
      blob;
    };
    files.add(fileId, metadata);
    metadata;
  };

  public shared ({ caller }) func updateFile(
    id : FileId,
    name : Text,
    description : Text,
    tagIds : [TagId],
  ) : async FileMetadata {
    requireAuth(caller);
    assertTagsExist(caller, tagIds);

    if (name == "") {
      Runtime.trap("File name cannot be empty");
    };

    let files = getUserFiles(caller);
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?metadata) {
        let uniqueName = getUniqueFileName(caller, metadata.folderId, name, ?id);
        let updated : FileMetadata = {
          id = metadata.id;
          name = uniqueName;
          description;
          tagIds;
          folderId = metadata.folderId;
          size = metadata.size;
          uploadDate = metadata.uploadDate;
          modifiedDate = Time.now();
          fileType = metadata.fileType;
          blob = metadata.blob;
        };
        files.remove(id);
        files.add(id, updated);
        updated;
      };
    };
  };

  public shared ({ caller }) func moveFile(id : FileId, newFolderId : ?FolderId) : async FileMetadata {
    requireAuth(caller);
    assertFolderExists(caller, newFolderId);

    let files = getUserFiles(caller);
    switch (files.get(id)) {
      case (null) { Runtime.trap("File not found") };
      case (?metadata) {
        let uniqueName = getUniqueFileName(caller, newFolderId, metadata.name, ?id);
        let updated : FileMetadata = {
          id = metadata.id;
          name = uniqueName;
          description = metadata.description;
          tagIds = metadata.tagIds;
          folderId = newFolderId;
          size = metadata.size;
          uploadDate = metadata.uploadDate;
          modifiedDate = Time.now();
          fileType = metadata.fileType;
          blob = metadata.blob;
        };
        files.remove(id);
        files.add(id, updated);
        updated;
      };
    };
  };

  public shared ({ caller }) func deleteFile(id : FileId) : async () {
    requireAuth(caller);

    let files = getUserFiles(caller);
    if (not files.containsKey(id)) {
      Runtime.trap("File not found");
    };
    files.remove(id);
  };

  public query ({ caller }) func getAllFiles() : async [FileMetadata] {
    requireAuth(caller);
    getUserFiles(caller).values().toArray();
  };

  // Search & Filter

  public query ({ caller }) func searchFilesWithTags(searchTerm : Text, filterTagIds : [TagId]) : async [FileMetadata] {
    requireAuth(caller);

    let files = getUserFiles(caller);
    let tags = getUserTags(caller);

    let hasSearch = searchTerm != "";
    let hasTags = filterTagIds.size() > 0;

    if (not hasSearch and not hasTags) {
      return files.values().toArray();
    };

    files.values().filter(
      func(f) {
        let matchesSearch = if (not hasSearch) {
          true;
        } else {
          textContainsIgnoreCase(f.name, searchTerm) or textContainsIgnoreCase(f.description, searchTerm) or f.tagIds.any(
            func(tagId) {
              switch (tags.get(tagId)) {
                case (null) { false };
                case (?tag) { textContainsIgnoreCase(tag.name, searchTerm) };
              };
            }
          );
        };

        let matchesTags = if (not hasTags) {
          true;
        } else {
          filterTagIds.any(
            func(filterTagId) {
              f.tagIds.any(func(fileTagId) { fileTagId == filterTagId });
            }
          );
        };

        matchesSearch and matchesTags;
      }
    ).toArray();
  };

  public query ({ caller }) func getAllTags() : async [Tag] {
    requireAuth(caller);
    getUserTags(caller).values().toArray();
  };

  public query ({ caller }) func getTag(id : TagId) : async Tag {
    requireAuth(caller);
    let tags = getUserTags(caller);
    switch (tags.get(id)) {
      case (null) { Runtime.trap("Tag not found") };
      case (?tag) { tag };
    };
  };

  public shared ({ caller }) func createTag(name : Text, color : Text) : async Tag {
    requireAuth(caller);

    if (name == "") {
      Runtime.trap("Tag name cannot be empty");
    };

    let tags = getUserTags(caller);
    let tagId = genTagId(caller);

    let tag : Tag = {
      id = tagId;
      name;
      color;
    };
    tags.add(tagId, tag);
    tag;
  };

  public shared ({ caller }) func updateTag(id : TagId, name : Text, color : Text) : async Tag {
    requireAuth(caller);

    if (name == "") {
      Runtime.trap("Tag name cannot be empty");
    };

    let tags = getUserTags(caller);
    switch (tags.get(id)) {
      case (null) { Runtime.trap("Tag not found") };
      case (?_) {
        let updated : Tag = {
          id;
          name;
          color;
        };
        tags.remove(id);
        tags.add(id, updated);
        updated;
      };
    };
  };

  public shared ({ caller }) func deleteTag(id : TagId) : async () {
    requireAuth(caller);

    let tags = getUserTags(caller);
    let files = getUserFiles(caller);

    if (not tags.containsKey(id)) {
      Runtime.trap("Tag not found");
    };

    // Remove tag from all files
    for (file in files.values()) {
      let hasTag = file.tagIds.any(func(tid) { tid == id });
      if (hasTag) {
        let newTagIds = file.tagIds.filter(func(tid) { tid != id });
        let updated : FileMetadata = {
          id = file.id;
          name = file.name;
          description = file.description;
          tagIds = newTagIds;
          folderId = file.folderId;
          size = file.size;
          uploadDate = file.uploadDate;
          modifiedDate = file.modifiedDate;
          fileType = file.fileType;
          blob = file.blob;
        };
        files.remove(file.id);
        files.add(file.id, updated);
      };
    };

    tags.remove(id);
  };

  // Bulk Operations

  public query ({ caller }) func getAllFilesInFolder(folderId : ?FolderId) : async [FileMetadata] {
    requireAuth(caller);

    let folders = getUserFolders(caller);
    let files = getUserFiles(caller);

    let folderIdSet = Map.empty<FolderId, ()>();
    var includeRoot = false;

    switch (folderId) {
      case (null) { includeRoot := true };
      case (?id) { folderIdSet.add(id, ()) };
    };

    // Iteratively collect all subfolder IDs
    var foundNew = true;
    while (foundNew) {
      foundNew := false;
      for (folder in folders.values()) {
        switch (folder.parentId) {
          case (?parentId) {
            if (folderIdSet.containsKey(parentId) and not folderIdSet.containsKey(folder.id)) {
              folderIdSet.add(folder.id, ());
              foundNew := true;
            };
          };
          case (null) {
            if (includeRoot and not folderIdSet.containsKey(folder.id)) {
              folderIdSet.add(folder.id, ());
              foundNew := true;
            };
          };
        };
      };
    };

    files.values().filter(
      func(f) {
        switch (f.folderId) {
          case (null) { includeRoot };
          case (?id) { folderIdSet.containsKey(id) };
        };
      }
    ).toArray();
  };

};
