
// GLOBALS (?)
let db, draft, conso;

function buildDraft () {
    const container = document.querySelector('#draft');

    const hot = new Handsontable(container, {
        dataSchema: {wday: null, from: null, to: null},
        colHeaders: ['GIORNO', 'DALLE', 'ALLE'],
        rowHeaders: (visualRowIndex) => visualRowIndex,
        afterChange: afterChangeHandler,
        minRows: 5,
        minSpareRows: 1,
        licenseKey: 'non-commercial-and-evaluation'
    });

    return hot;
}

function buildConso () {
    const container = document.querySelector('#conso');

    const hot = new Handsontable(container, {
        dataSchema: {wday: null, from: null, to: null},
        colHeaders: ['GIORNO', 'DALLE', 'ALLE'],
        rowHeaders: (visualRowIndex) => visualRowIndex,
        minRows: 5,
        licenseKey: 'non-commercial-and-evaluation'
    });

    return hot;
}

async function afterChangeHandler (changes, source) {
    // console.log('handler hit', changes, source);
    if (['edit', 'CopyPaste.cut', 'CopyPaste.paste'].includes(source)) {
        
        // console.log('handler working');
        const chain = [];
        for (const c of changes) {
            const [id, prop,, value] = c;

            try {
                const updated = await db.workingHours.update(id, {[prop]: value});
                if (!updated) {
                    const result = await db.workingHours.add({id, [prop]: value});
                    // console.log(result);
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
}

function validateRow (row) {
    try {
        if (!(row.wday && row.from && row.to)) {
            throw new Error(`Missing prop at row ${row.id}`);
        };

        const wdayIndex = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].indexOf(row.wday);
        if (wdayIndex < 0) throw new Error(`Malformed wday at row ${row.id}`);

        let match = row.from.match(/(\d\d*):(\d\d)/);
        if (!match) throw new Error(`Malformed from at row ${row.id}`);
        const [, h0, m0] = match.map(e => parseInt(e));
        if (!(h0 >= 0 && h0 < 24 && m0 >= 0 && m0 < 60)) {
            throw new Error(`Malformed from at row ${row.id}, out of range`);
        }

        match = row.to.match(/(\d\d*):(\d\d)/);
        if (!match) throw new Error(`Malformed to at row ${row.id}`);
        const [, h1, m1] = match.map(e => parseInt(e));
        if (!(h1 >= 0 && h1 < 24 && m1 >= 0 && m1 < 60)) {
            throw new Error(`Malformed to at row ${row.id}, out of range`);
        }

        if ((h0 * 60 + m0) >= (h1 * 60 + m1)) {
            // console.log(h0, m0, h1, m1);
            throw new Error(`Malformed duration at row ${row.id}`);
        }

        // row is valid
        row.linearTimeWeekly = wdayIndex * 1440 + h0 * 60 + m0;
        return true;
        
    } catch (error) {
        console.error(error);
        return false;
    }
}

function getValidatedRows () {
    const wellFormed = [];
    
    return db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        for (const r of rows) {
            const v = validateRow(r);
            if (v) wellFormed.push(r);
        }
        return wellFormed;
    })
    .then((rows) => {
        const sorted = rows.sort((a, b) => a.linearTimeWeekly - b.linearTimeWeekly).map(e => [e.wday, e.from, e.to]);
        return sorted;
    })
    .catch(e => console.error(e));
}

function dbRowsToChanges (rows) {
    // rows is [{id, wday, from, to}, ...]

    let changes = [];
    let emptyIndexes = [];
    let empty;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        empty = true;

        if (row.wday) {
            changes.push([row.id, 'wday', row.wday]);
            empty = false;
        }
        if (row.from) {
            changes.push([row.id, 'from', row.from]);
            empty = false;
        }
        if (row.to) {
            changes.push([row.id, 'to', row.to]);
            empty = false;
        }
        if (empty) {
            emptyIndexes.push(row.id);
        }
    }
    return {changes, empty: emptyIndexes};
}



function populateDraftFromDB () {
    db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        // writing startegy #1, `setDataAtRowProp`        
        const {changes, empty} = dbRowsToChanges(rows);
        draft.setDataAtRowProp(changes, null, null, 'fff:init');
        // can't figure out what is the right place to clean up db, i.e. remove empty rows
        // i'll tentatively do it here
        db.workingHours.bulkDelete(empty);
    })
    .catch(e => console.error(e));
}

function populateConsoFromDB () {
    getValidatedRows()
    .then((rows) => {
        // writing startegy #2, `populateFromArray`
        conso.clear();
        if (rows.length > 0) conso.populateFromArray(0, 0, rows);
        conso.deselectCell();
    })
    .catch(e => console.error(e));
}

function copyToDraft () {
    console.log('copy to draft');
    const d = conso.getData().map((e, i) => ({id: i, wday: e[0], from: e[1], to: e[2]}));
    console.log(d);
}



function enterDraftMode () {
    // console.log('enter draft mode');
    Alpine.store('ui').mode = 'draft';
}

function enterConsoMode () {
    // console.log('enter conso mode');
    populateConsoFromDB();
    Alpine.store('ui').mode = 'conso';
}



// MAIN
function main () {
    
    // init dexie
    db = new Dexie('fffontas');
    db.version(1).stores({
        workingHours: 'id'
    });

    db.workingHours.hook('creating', function (primKey, obj, trans) {
        // console.log('creating', primKey, obj, trans);
        console.log('creating', obj);
    });
    db.workingHours.hook('updating', function (mods, primKey, obj, trans) {
        console.log('updating', mods, obj);
    });


    // init views
    draft = buildDraft();
    conso = buildConso();

    populateDraftFromDB();
}


if (document.readyState === "loading") {
    // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", main);
} else {
    // `DOMContentLoaded` has already fired
    main();
}



  