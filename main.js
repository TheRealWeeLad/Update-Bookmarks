window.addEventListener("load", () => {
    const selector = document.getElementById('folder');
    selector.addEventListener('change', update);

    // Change Input Value to Default Value
    chrome.storage.local.get('default', (items) => {
        let default_input = items.default;

        // Set default if none exists
        if (!default_input) { 
            default_input = '';
            chrome.storage.local.set({"default": ""});
        }

        // Set Folder Options
        set_folder_options(default_input);

        update();
    });

    let folder_name = selector.value;
    const sites_div = document.getElementById('sites-container');

    // Set update handler
    const update_button = document.getElementById('update');
    update_button.addEventListener('click', update);

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

    // Set Forward and Back Arrow Handlers
    const arrow_container = document.querySelector('#arrows');
    const back_arrow = arrow_container.children.item(0);
    back_arrow.addEventListener('click', () => changeFolder(-1));
    const forward_arrow = arrow_container.children.item(1);
    forward_arrow.addEventListener('click', () => changeFolder(1));

    function do_sussy_things_to_bookmarks(sussy) {
        chrome.bookmarks.getRootByName('bookmarks_bar', (root) => {
            chrome.bookmarks.getChildren(root.id, (children) => {
                children.forEach(sussy);
            });
        });
    }

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
                plus.className = 'inc';
                const minus = document.createElement('img');
                minus.src = 'minus.png';
                minus.className = 'inc';

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

    function set_folder_options(default_option) {
        do_sussy_things_to_bookmarks((bookmark) => {
            if (bookmark.url) return;

            const option = document.createElement('option');
            option.value, option.textContent = bookmark.title;
            selector.appendChild(option);
        });
        
        setTimeout(() => { selector.value = default_option; update(); }, 100);
    }

    function changeFolder(dF) {
        chrome.bookmarks.getRootByName('bookmarks_bar', (root) => {
            chrome.bookmarks.getChildren(root.id, (children) => {
                const folders = [];
                for (let i = 0; i < children.length; i++) {
                    if (!children[i].url) folders.push(children[i]);
                }

                const curr_folder_idx = folders.findIndex((e) => e.title === folder_name);
                let new_folder_idx = curr_folder_idx + dF;
                new_folder_idx = new_folder_idx >= folders.length ? 0 : (new_folder_idx < 0 ? folders.length - 1 : new_folder_idx);
                const new_folder = folders[new_folder_idx];
                selector.value = new_folder.title;
                update();
            });
        });
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

        folder_name = selector.value;

        if (folder_name === '') {
            return;
        }

        chrome.bookmarks.getTree(bmTree => {
            bmTree.forEach(node => {
                processNode(node);
            });
        });
    }

    function set_default() {
        chrome.storage.local.set({"default": folder_name});
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

            selector.value = sites[0].replace(return_comma, ',');

            setTimeout(update, 100);
        });

        reader.readAsText(file);
    }

    function export_list() {
        do_sussy_things_to_bookmarks((bookmark) => {
            if (bookmark.title === folder_name) {
                chrome.bookmarks.getChildren(bookmark.id, (sites) => {
                    let export_data = folder_name.replace(/,/g, comma_replacer) + ',';
                    const title = export_data.substring(0, export_data.length - 1).replace(/ /g, '_');

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
                        filename: `${title}.csv`
                    });
                });
            }
        });
    }
});