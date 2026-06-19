import strawberry
from sqlalchemy.orm import Session

from app.schemas.types import LearningType


@strawberry.type
class Mutation:
    @strawberry.mutation
    def delete_learning(self, info: strawberry.types.Info, learning_id: str) -> bool:
        """Delete a learning by UUID. Returns True if deleted, False if not found."""
        from app.models import Learning as LearningModel
        from app.services.storage import delete_audio_from_cloudinary

        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return False

        learning = (
            db.query(LearningModel)
            .filter(LearningModel.id == learning_id, LearningModel.user_id == user.id)
            .first()
        )
        if not learning:
            return False

        # Delete audio from Cloudinary
        if learning.audio_public_id:
            delete_audio_from_cloudinary(learning.audio_public_id)

        db.delete(learning)
        db.commit()
        return True
