# Return actual IndexedDB completion to the native host before removing staged data.
my $start = index($_, '  function importText(');
my $end = index($_, "\n  function handleImportFile", $start);
die "gallery import function not found\n" if $start < 0 || $end < 0;
my $block = substr($_, $start, $end - $start);
$block =~ s~function importText\(text, fileName, page\)~function importText(text, fileName, page, token)~;
$block =~ s~      return;~      return Promise.resolve(false);~;
$block =~ s~    window.FlickGalleryStore.listProjects~    return window.FlickGalleryStore.listProjects~;
$block =~ s~(then\(function \(items\) \{)~$1\n      var importedId = token ? 'incoming-' + token : undefined;\n      var existing = importedId && items.filter(function (p) { return p.id === importedId; })[0];\n      if (existing) return existing;~;
$block =~ s~(return window.FlickGalleryStore.putProject\(\{)~$1\n        id: importedId,~;
$block =~ s~(      navigate\(page \+ '\?id=' \+ encodeURIComponent\(saved.id\)\);)~$1\n      return true;~;
$block =~ s~(      showToast\(err && err.message \? err.message : T\('Failed to import'\)\);\n)(    \}\);)~$1      return false;\n$2~;
substr($_, $start, $end - $start) = $block;
s~function importIncoming\(base64, fileName, page\)~function importIncoming(base64, fileName, page, token)~;
s~    importText\(new TextDecoder\('utf-8'\).decode\(bytes\), fileName, page\);~    return importText(new TextDecoder('utf-8').decode(bytes), fileName, page, token);~;
