"use strict";

const Baileys = require("baileys");

class GroupData {
    constructor(ctx, jid) {
        this.ctx = ctx;
        this.jid = jid;
    }

    async members() {
        const metadata = await this.metadata();
        return metadata.participants;
    }

    async inviteCode() {
        return await this.ctx._client.groupInviteCode(this.jid);
    }

    async revokeInviteCode() {
        return await this.ctx._client.groupRevokeInvite(this.jid);
    }

    async joinApproval(mode) {
        return await this.ctx._client.groupJoinApprovalMode(this.jid, mode);
    }

    async leave() {
        await this.ctx._client.groupLeave(this.jid);
    }

    async membersCanAddMemberMode(mode) {
        return await this.ctx._client.groupMemberAddMode(this.jid, mode === "on" ? "all_member_add" : "admin_add");
    }

    async metadata() {
        return await this.ctx._client.groupMetadata(this.jid);
    }

    async getMetadata(key) {
        const metadata = await this.metadata();
        return metadata[key];
    }

    async name() {
        return await this.getMetadata("subject");
    }

    async description() {
        return await this.getMetadata("desc");
    }

    async owner() {
        return await this.getMetadata("owner");
    }

    async isMemberExist(jid) {
        const members = await this.members();
        const check = members.some(member => Baileys.jidNormalizedUser(member.id) === Baileys.jidNormalizedUser(jid) || Baileys.jidNormalizedUser(member.lid) === Baileys.jidNormalizedUser(jid));
        return check;
    }

    async isAdmin(jid) {
        const members = await this.members();
        const check = members.filter(member => (Baileys.jidNormalizedUser(member.id) === Baileys.jidNormalizedUser(jid) || Baileys.jidNormalizedUser(member.lid) === Baileys.jidNormalizedUser(jid)) && (member.admin === "admin" || member.admin === "superadmin"));
        return check.length > 0;
    }

    async isOwner(jid) {
        const members = await this.members();
        const check = members.filter(member => (Baileys.jidNormalizedUser(member.id) === Baileys.jidNormalizedUser(jid) || Baileys.jidNormalizedUser(member.lid) === Baileys.jidNormalizedUser(jid)) && member.admin === "superadmin");
        return check.length > 0;
    }

    async isSenderAdmin() {
        return await this.isAdmin(this.ctx.sender.decodedJid);
    }

    async isSenderOwner() {
        return await this.isOwner(this.ctx.sender.decodedJid);
    }

    async isBotAdmin() {
        return await this.isAdmin(this.ctx.me.decodedId);
    }

    async toggleEphemeral(expiration) {
        return await this.ctx._client.groupToggleEphemeral(this.jid, expiration);
    }

    async updateDescription(description) {
        return await this.ctx._client.groupUpdateDescription(this.jid, description);
    }

    async updateSubject(subject) {
        return await this.ctx._client.groupUpdateSubject(this.jid, subject);
    }

    async membersUpdate(members, action) {
        return await this.ctx._client.groupParticipantsUpdate(this.jid, Array.isArray(members) ? members : [members], action);
    }

    async kick(members) {
        return await this.membersUpdate(members, "remove");
    }

    async add(members) {
        return await this.membersUpdate(members, "add");
    }

    async promote(members) {
        return await this.membersUpdate(members, "promote");
    }

    async demote(members) {
        return await this.membersUpdate(members, "demote");
    }

    async pendingMembers() {
        return await this.ctx._client.groupRequestParticipantsList(this.jid);
    }

    async pendingMembersUpdate(members, action) {
        return await this.ctx._client.groupRequestParticipantsUpdate(this.jid, members, action);
    }

    async approvePendingMembers(members) {
        return await this.pendingMembersUpdate(members, "approve");
    }

    async rejectPendingMembers(members) {
        return await this.pendingMembersUpdate(members, "reject");
    }

    async updateSetting(setting) {
        await this.ctx._client.groupSettingUpdate(this.jid, setting);
    }

    async open() {
        await this.updateSetting("not_announcement");
    }

    async close() {
        await this.updateSetting("announcement");
    }

    async lock() {
        await this.updateSetting("locked");
    }

    async unlock() {
        await this.updateSetting("unlocked");
    }
}

module.exports = GroupData;