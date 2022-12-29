window.addEventListener("load", () => {
    const input = document.getElementById('folder');

    // Change Input Value to Default Value
    chrome.storage.local.get('default', (items) => {
        let default_input = items.default;

        // Set default if none exists
        if (!default_input) { 
            default_input = '';
            chrome.storage.local.set({"default": ""});
        }

        input.value = default_input;
        update();
    });

    let folder_name;
    const sites_div = document.getElementById('sites-container');

    // Set update handler
    const update_button = document.getElementById('update');
    update_button.addEventListener('click', update);

    // SET PRESET HANDLER
    const add_preset_button = document.getElementById('preset');
    add_preset_button.addEventListener('click', add_preset);
    const remove_preset_button = document.getElementById('preset_rem');
    remove_preset_button.addEventListener('click', remove_preset);

    // Set default handler
    const default_button = document.getElementById('default');
    default_button.addEventListener('click', set_default);

    // Set import and export handlers
    const import_input = document.getElementById('import-input');
    import_input.addEventListener('change', import_list);
    const import_button = document.getElementById('import');
    import_button.addEventListener('click', () => import_input.click());
    const export_button = document.getElementById('export');
    export_button.addEventListener('click', export_list);

    update();

    function isChapterLast(title) {
        title = title.split(' ');
        return !isNaN(parseInt(title[title.length - 1])) && title[title.length - 2] === '-';
    }
    
    function isValidChapter(title) {
        title = title.split(' ');
        const chap_idx = title.indexOf('-') + 1;
        return !isNaN(parseInt(title[chap_idx]));
    }

    function fixChapter(title) {
        title = title.split(' ');
        const chap_idx = title.indexOf('-') + 1;
        const chapter = title[chap_idx];
        
        let fixed_chapter;
        try {
            fixed_chapter = /\d+/.exec(chapter)[0];
        }
        catch (e) {
            alert('An Error Occurred with "' + title.join(' ').split(' - ')[0] + '"');
            return null;
        }
        title[chap_idx] = fixed_chapter;
        return title.join(' ');
    }

    function processNode(node) {
        if (node.children) {
            if (!node.parentId || node.title === 'Bookmarks bar' || node.title === folder_name) {
                node.children.forEach(child => {
                    processNode(child);
                });
            }
        } else if (node.url) {
            if (node.parentId === '1') return;

            const titles = node.title.split(' / ');
            titles.forEach(title => {
                if (!isValidChapter(title)) {
                    const name = title.split(' - ')[0];
                    alert('Incorrect Format for "' + name + '"');
                    return;
                }

                // Fix Chapter Number
                title = fixChapter(title);

                if (!title) return;

                const title_parts = title.split(' ');

                while (!isChapterLast(title)) {
                    title_parts.pop();
                    title = title_parts.join(' ');
                }
                const site = document.createElement('h4');
                site.class = 'site';
                site.innerText = title_parts.join(' ');

                const plus = document.createElement('img');
                plus.src = 'plus.png';
                const minus = document.createElement('img');
                minus.src = 'minus.png';

                site.appendChild(minus);
                site.appendChild(plus);

                plus.addEventListener('click', () => increment(site, true));
                minus.addEventListener('click', () => increment(site, false));

                sites_div.appendChild(site);
            });
        }
    }

    function processNodeChapter(node, old_title, new_title) {
        if (node.children) {
            if (!node.parentId || node.title === 'Bookmarks bar' || node.title === folder_name) {
                node.children.forEach(child => {
                    processNodeChapter(child, old_title, new_title);
                });
            }
        } else if (node.url) {
            let node_title = node.title;

            const node_name = node_title.split(' - ');

            if (node_name[0] === old_title.split(' - ')[0]) {
                // Fix Chapter Number
                node_title = fixChapter(node_title);

                const title_parts = node_title.split(' ');

                while (!isChapterLast(node_title)) {
                    const thing = title_parts.pop();
                    node_title = title_parts.join(' ');
                    new_title += ` ${thing}`;
                }
                
                chrome.bookmarks.update(node.id, {title: new_title});
            }
        }
    }

    function increment(site, add) {
        site_parts = site.innerText.split(' - ')
        const old_site_title = site.innerText;

        let chapter = parseInt(site_parts.pop());
        if (add) chapter++;
        else chapter--;

        site_parts.push(chapter.toString());

        const plus = site.children.item(1);
        const minus = site.children.item(0);

        site.innerText = site_parts.join(' - ');
        site.appendChild(minus);
        site.appendChild(plus);

        updateBookmark(old_site_title, site.innerText);
    }

    function updateBookmark(old_title, new_title) {
        chrome.bookmarks.getTree(bmTree => {
            bmTree.forEach(node => {
                processNodeChapter(node, old_title, new_title);
            });
        });
    }

    function update() {
        sites_div.innerHTML = '<h2>Sites: </h2>';

        folder_name = input.value;

        update_preset_buttons();

        if (folder_name === '') {
            return;
        }

        chrome.bookmarks.getTree(bmTree => {
            bmTree.forEach(node => {
                processNode(node);
            });
        });
    }

    function update_preset_buttons() {
        chrome.storage.local.get('presets', (items) => {
            const presets = items.presets;

            if (!presets) {
                chrome.storage.local.set({'presets': []});
                return;
            }

            const preset_div = document.getElementById('presets');

            // Reset presets
            preset_div.innerHTML = '<h2 id="preset-header">Presets</h2>';

            presets.forEach((preset) => {
                const new_preset = document.createElement('button');
                new_preset.className = 'preset';
                new_preset.textContent = preset;
                preset_div.appendChild(new_preset);

                // Update event handlers
                new_preset.addEventListener('click', () => {
                    input.value = preset;
                    update();
                });
            });
        });
    }

    function add_preset() {
        // Update Storage
        chrome.storage.local.get('presets', (items) => {
            const presets = items.presets;

            if (presets.includes(input.value)) return;

            presets.push(input.value);

            chrome.storage.local.set({"presets": presets});

            // Update Buttons
            update_preset_buttons();
        });
    }

    function remove_preset() {
        // Update Storage
        chrome.storage.local.get('presets', (items) => {
            let presets = items.presets;

            if (!presets.includes(input.value)) return;

            const item_idx = presets.indexOf(input.value);
            presets = presets.slice(0, item_idx).concat(presets.slice(item_idx + 1));
            
            chrome.storage.local.set({"presets": presets});

            // Update Buttons
            update_preset_buttons();
        });
    }

    function set_default() {
        chrome.storage.local.set({"default": input.value});
    }

    const comma_replacer = '&!!##--@!!';
    const return_comma = new RegExp(`${comma_replacer}`, 'g');

    function add_bookmark_folder(sites) {
        chrome.bookmarks.getRootByName('bookmarks_bar', (root) => {
            // Check for existing folder
            chrome.bookmarks.getChildren(root.id, (children) => {
                children.forEach((child) => {
                    const name = child.title.replace(/,/g, comma_replacer);
                    
                    // Delete existing folder if one already exists
                    if (sites[0] === name) {
                        chrome.bookmarks.getChildren(child.id, (dumb_sites) => {
                            // Get rid of the stupid sites (YUCK!!)
                            dumb_sites.forEach((site) => {
                                chrome.bookmarks.remove(site.id);
                            });
                            chrome.bookmarks.remove(child.id);
                        });
                    }
                });

                // Create a new folder to put sites in
                const folder_title = sites[0].replace(return_comma, ',');
                chrome.bookmarks.create({
                    'title': folder_title,
                    'parentId': '1'
                }, (new_folder) => {
                    sites.shift();

                    for (let i = 0; i < sites.length; i += 2) {
                        const title = sites[i].replace(return_comma, ',');
                        const url = sites[i + 1].replace(return_comma, ',');

                        chrome.bookmarks.create({
                            'title': title,
                            'url': url,
                            'parentId': new_folder.id
                        });
                    }
                });
            });
        });
    }

    function import_list() {
        const file = import_input.files[0];
        const reader = new FileReader();

        reader.addEventListener('load', (event) => {
            const sites = event.target.result.split(',');

            if (sites.length < 3 || !sites[2].startsWith('http')) {
                alert('Incorrect List Format');
                return;
            }

            add_bookmark_folder(sites);

            input.value = sites[0].replace(return_comma, ',');

            setTimeout(update, 200);
        });

        reader.readAsText(file);
    }

    // I LOVE NESTING
    function export_list() {
        chrome.bookmarks.getRootByName('bookmarks_bar', (root) => {
            chrome.bookmarks.getChildren(root.id, (children) => {
                children.forEach((child) => {
                    if (child.title === folder_name) {
                        chrome.bookmarks.getChildren(child.id, (sites) => {
                            let export_data = folder_name.replace(/,/g, comma_replacer) + ',';

                            sites.forEach((site) => {
                                let title = site.title;
                                title = title.replace(/,/g, comma_replacer);
                                let url = site.url;
                                url = url.replace(/,/g, comma_replacer);

                                export_data += title + ',' + url + ',';
                            });

                            export_data = export_data.substring(0, export_data.length - 1);

                            const blob = new Blob([export_data], {type: "text/csv"});
                            const url = URL.createObjectURL(blob);

                            chrome.downloads.download({
                                url: url,
                                filename: "site_list.csv"
                            });
                        });
                    }
                });
            });
        });
    }
});