export function activityArt(session) {
    const name = `${session.sessionType} ${session.title}`.toLowerCase();
    if (/yoga|mobility|stabi|stretch/.test(name))
        return 'yoga';
    if (/strength|kraft/.test(name))
        return 'strength';
    if (/swim|schwimm/.test(name))
        return 'swim';
    if (/sportspiel|fußball|fussball|basketball|volleyball/.test(name))
        return 'sportspiel';
    if (/golf/.test(name))
        return 'golf';
    if (/recovery|regeneration|ruhetag/.test(name))
        return 'recovery';
    if (/run|lauf|cooper|jog/.test(name))
        return 'run';
    return 'bike';
}
