import { Module } from '@nestjs/common';
import { StoryModule } from 'src/story/story.module';
import { ChainService } from './chain.service'
import { DesmosModule } from './desmos/desmos.module';

@Module({
  imports: [
    StoryModule,
    DesmosModule,
  ],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
