-- Append-only. Persistent 1:3 member placement only; no financial balances or payout records.
CREATE TABLE matrix_state (
 id TINYINT NOT NULL,
 nextSequence INT NOT NULL,
 PRIMARY KEY(id),
 CONSTRAINT matrix_state_singleton CHECK (id = 1),
 CONSTRAINT matrix_state_positive CHECK (nextSequence >= 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO matrix_state(id,nextSequence) VALUES(1,1);

CREATE TABLE matrix_positions (
 id CHAR(36) NOT NULL,
 sequence INT NOT NULL,
 memberId CHAR(36) NOT NULL,
 parentId CHAR(36) NULL,
 slot TINYINT NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id),
 UNIQUE KEY matrix_positions_sequence_key(sequence),
 UNIQUE KEY matrix_positions_memberId_key(memberId),
 UNIQUE KEY matrix_positions_parentId_slot_key(parentId,slot),
 KEY matrix_positions_parentId_sequence_idx(parentId,sequence),
 CONSTRAINT matrix_positions_memberId_fkey FOREIGN KEY(memberId) REFERENCES member_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT matrix_positions_parentId_fkey FOREIGN KEY(parentId) REFERENCES matrix_positions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT matrix_positions_slot_range CHECK (slot BETWEEN 0 AND 3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
