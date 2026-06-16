from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.settlements.repository import SettlementRepository
from app.api.settlements.schemas import (
    BalanceDetail,
    BalanceSummary,
    SettlementCreate,
    SettlementListResponse,
    SettlementPublic,
    UserBalance,
)
from app.api.notifications.service import NotificationService
from app.api.users.repository import UserRepository
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.logging import logger
from app.models.user import User
from app.utils.balance import compute_balance_summary, compute_user_balances


class SettlementService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SettlementRepository(db)
        self.user_repo = UserRepository(db)
        self.notif_service = NotificationService(db)

    async def create_settlement(
        self, current_user: User, data: SettlementCreate
    ) -> SettlementPublic:
        receiver = await self.user_repo.get_by_id(data.receiver_id)
        if not receiver:
            raise NotFoundException("Receiver not found")

        settlement = await self.repo.create(
            payer_id=current_user.id,
            receiver_id=data.receiver_id,
            amount=data.amount,
            payment_method=data.payment_method,
        )

        await self.notif_service.create(
            user_id=data.receiver_id,
            title="Settlement pending approval",
            message=f"{current_user.name} recorded a payment of ₹{data.amount:.2f} via {data.payment_method}. Please confirm.",
            notification_type="settlement_pending",
        )

        logger.info(f"Settlement recorded: {current_user.id} -> {data.receiver_id}, ₹{data.amount}")
        return SettlementPublic.model_validate(settlement)

    async def approve_settlement(
        self, current_user: User, settlement_id: str
    ) -> SettlementPublic:
        settlement = await self.repo.get_by_id(settlement_id)
        if not settlement:
            raise NotFoundException("Settlement not found")

        if settlement.receiver_id != current_user.id:
            raise ForbiddenException("Only the receiver can approve this settlement")

        if settlement.status == "completed":
            return SettlementPublic.model_validate(settlement)

        settlement = await self.repo.complete(settlement)

        # Notify the payer
        await self.notif_service.create(
            user_id=settlement.payer_id,
            title="Settlement approved",
            message=f"{current_user.name} approved your settlement of ₹{settlement.amount:.2f}",
            notification_type="settlement_completed",
        )

        logger.info(f"Settlement approved: {settlement.id}")
        return SettlementPublic.model_validate(settlement)

    async def list_settlements(self, current_user: User) -> SettlementListResponse:
        settlements = await self.repo.get_user_settlements(current_user.id)
        return SettlementListResponse(
            settlements=[SettlementPublic.model_validate(s) for s in settlements],
            total=len(settlements),
        )

    async def get_balance_detail(self, current_user: User) -> BalanceDetail:
        summary_data = await compute_balance_summary(self.repo.db, current_user.id)
        per_user_data = await compute_user_balances(self.repo.db, current_user.id)

        return BalanceDetail(
            summary=BalanceSummary(**summary_data),
            per_user=[UserBalance(**b) for b in per_user_data],
        )
